# Architecture

## Folder layout

```
src/
  app/            Next.js routes — pages (server components) + the one API catch-all
    api/[...route]/route.ts   Hono app mounted at /api, handles every API request
    <page>/page.tsx            Server components: fetch via db/auth directly, no client fetch on first paint
  components/     Client + shared UI. components/ui/ is generic primitives (Sheet, icons, grid)
  server/         Hono route modules (one per API area) + server/shared.ts
  lib/            Everything else, grouped by concern (see below)
  db/             Drizzle schema + client
mobile/           A separate Expo/React Native project — own package.json,
                  not part of the npm-workspaces or Next.js build. Being
                  re-hosted as a standalone app that owns its own SQLite
                  database and talks to AniList/MAL/Nyaa directly, rather
                  than a client against this server's API
                  (see Dependency direction, and planning/STANDALONE.md)
```

Inside `mobile/`, mirroring the web app's own `@/*` → `./src/*` alias:

```
mobile/src/
  app/            expo-router file tree. app/_layout.tsx is the auth gate;
                  app/(tabs)/ is the four-destination tab bar that matches
                  the web's SiteHeader (Library, Schedule, Search, Settings)
  api/            on its way out — nothing sets a base URL since Phase 2
                  removed the server URL, so apiRequest reports that plainly
                  until Phase 3 replaces the three data tabs' calls with
                  local queries + direct AniList requests
  auth/           on-device OAuth: config.ts (client ids + redirect URIs),
                  url.ts (encoding, expo-free so it can be run off-device),
                  oauth.ts (the browser round trip), anilist.ts (implicit
                  grant), mal.ts (PKCE plain + refresh), token-store.ts
                  (SecureStore), context.tsx (the gate's status)
  polyfills.ts    imported first: AbortSignal.timeout, which every shared
                  client calls and React Native does not ship
  db/             the device's own database: schema.ts (a port of
                  src/db/schema.ts minus userId and the auth tables),
                  client.ts (expo-sqlite + drizzle), migrations-gate.tsx
                  (applies mobile/drizzle/ at launch, before any screen
                  renders — the phone's docker-entrypoint.sh)
  components/     screen-level pieces (cards, chips, badges)
  ui/             generic primitives — the counterpart of components/ui/
  hooks/          cross-screen hooks (the clock, the sort preference)
  theme.ts        the web's globals.css tokens, ported flat and dark-only
```

`lib/` subfolders, one per external system or domain concern:

```
lib/anilist/     GraphQL client + queries against AniList
lib/mal/         REST client + queries against MyAnimeList
lib/nyaa/        RSS fetch, parsing, title parsing, filtering
lib/airing/      The poller + its scheduling state machine
lib/sync/        Progress dual-write, mirror reconciliation, tracker-entry writes, status mapping
lib/email/       Mailer + the one notification it sends
lib/schedule/    Grouping next-airing entries by day for /schedule
lib/library/     Filtering, sorting, refresh (re-running a saved Nyaa search)
lib/test-support/ Fakes for db and fetch, used only from *.test.ts
```

## The request path

Two kinds of route, and they don't share a layer:

- **Pages** (`app/*/page.tsx`) are server components. They call `db` and
  `auth` directly — there is no client-side fetch for first paint. Session
  check is always `const session = await auth.api.getSession(...)` followed
  by `redirect("/login")` if absent; every page that needs a user repeats
  this rather than a shared layout guard, because Next's layouts can't
  redirect based on a per-route session check cleanly here.
- **API routes** all funnel through `app/api/[...route]/route.ts`, a single
  Hono app exported as the Next.js route handler (`hono/vercel`'s `handle`).
  Hono owns sub-routing from there — each `server/*-routes.ts` file is
  mounted with `app.route("/x", xRoutes)`.

## The one boundary that matters most: `server/shared.ts`

Every Hono route module imports from here rather than repeating auth,
error-mapping, or entry-lookup logic. It exists because those three things
were each written three or four times over per route file and had begun to
drift — the same tracker failure produced a different HTTP status depending
which module caught it (see the file's own header comment).

What it gives every route:
- `requireSession` — middleware; sets `c.get("userId")`, 401s otherwise.
- `handleUpstreamErrors` — the one `onError` handler, mapping
  `TokenError` → 401, `AniListError` → 429/502, `MalError`/`NyaaFetchError`
  → 502, anything else → 500 + `console.error`. **A route handler should let
  these propagate, not catch-and-map them itself.**
- `requireEntry` / `findEntry` — scopes every lookup to
  `(id, userId)` together, so an id from another account 404s instead of
  leaking existence. **Never query `libraryEntry` by id alone in a route.**
- `parseBody` / `parseParam` — Zod-validated body/param parsing with a
  consistent 400/404 shape.

Rule: **a new route module gets these from `server/shared.ts`, never
reimplements them.** That's the whole reason the file exists.

## The background poller

`lib/airing/poller.ts` runs as a `setInterval` loop *inside the Next.js
server process* — not a cron container, not a queue worker. It's started
from `src/instrumentation.ts`, which Next calls once per server instance in
every runtime; the poller only actually starts under the Node runtime (not
Edge — libSQL and timers don't exist there) and only outside the Docker
build phase (the build talks to a throwaway SQLite file with no real
config). `AIRING_POLLER=off` is the escape hatch for `next dev`, where the
server restarts constantly.

This means: **there is exactly one poller per running server instance, and
no coordination between instances exists.** Running more than one container
against the same database would double-poll. The deployment model
(single Docker Compose service, one SQLite file) makes this safe today —
don't scale this horizontally without adding that coordination first.

## Data access

- `db` (Drizzle + libSQL) is imported directly wherever it's needed —
  pages, route modules, the poller, `lib/library/refresh.ts`. There is no
  repository/service layer between Drizzle and callers; Drizzle's query
  builder *is* the data layer. Keep queries in the module that uses them
  rather than centralizing a data-access layer that doesn't otherwise
  exist.
- Every domain table (`library_entry`, `rss_filter`, `episode`,
  `stremio_token`) carries or descends from `userId`. Every query against
  them must filter on it (directly or via a join to `library_entry`) —
  there is no other tenant isolation.
- Schema changes go through `npm run db:generate` (writes a new file under
  `drizzle/`) then `npm run db:migrate` (applies pending migrations,
  idempotent — also runs on every container boot via
  `docker-entrypoint.sh`).
- **There are now two databases and two migration trees.** The device's is
  `mobile/src/db/schema.ts` → `npm run db:generate` *in `mobile/`* →
  `mobile/drizzle/`, applied at app launch by `src/db/migrations-gate.tsx`
  rather than by a shell script. The rule that files under `drizzle/` are
  generated and never hand-edited applies to both. They are separate
  databases with no sync between them: AniList is what keeps the two clients'
  library and progress agreeing, and Nyaa filters simply diverge.

## Dependency direction

`app/` and `server/` depend on `lib/` and `db/`; `lib/` modules do not
import from `app/` or `server/`. Within `lib/`, `lib/providers.ts` is
deliberately dependency-free (no `db` import) because client components
import it directly for the AniList/MAL label constants — pulling `db` in
would drag the database into the client bundle.

`mobile/` may import from `src/lib/` — its dependency-free modules, via the
`@shared/*` alias — but **never** from `src/app/`, `src/server/`, or
`src/db/`. That rule matters more under the standalone plan, not less: the
set of shared modules widens from four (`lib/library/filters.ts`,
`lib/library/sort.ts`, `lib/schedule/group.ts`, `lib/providers.ts`) to most
of the domain layer, so the temptation to reach one module further is
greater. A module is shareable only if it imports no `db`, no `env` and
nothing from `app/`/`server/`; anything db-bound (`lib/tokens.ts`,
`lib/anilist/import.ts`, `lib/library/refresh.ts`'s wiring) gets a device
equivalent rather than an import.

**"Imports nothing" is necessary but not sufficient.** A module can be
dependency-free and still not run under Hermes, because React Native's
globals are not the server's: `AbortSignal.timeout` — called by
`lib/anilist/client.ts`, `lib/mal/client.ts` and `lib/nyaa/rss.ts`, i.e. every
external client the standalone app depends on — simply does not exist there.
The fix is `mobile/src/polyfills.ts`, imported first in `_layout.tsx`, not a
forked copy of those modules: where the runtimes differ, the runtime is what
gets patched, so the domain layer stays shared.

The two clients are no longer the same kind of thing. The web app talks to
this server; the standalone mobile app talks to AniList, MyAnimeList and
Nyaa directly and queries its own on-device SQLite. It does not import
server code, and it no longer calls `/api/*` either. If both keep running,
AniList holds library and progress consistently across them, while Nyaa
filters are per-client and diverge by design.

## Testing layout

Tests are colocated as `*.test.ts` next to the module they cover (e.g.
`lib/nyaa/rss.test.ts`, `server/library-routes.test.ts`), run via Node's
built-in test runner (`node --experimental-strip-types ... --test`), not a
separate `tests/` tree. Fakes live in `lib/test-support/` (`db-stub.ts`,
`fetch-stub.ts`) and are imported by tests that need to avoid hitting a
real database or network.

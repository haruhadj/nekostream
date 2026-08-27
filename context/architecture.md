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
mobile/           A separate Expo/React Native project — a second client
                  against the same API, own package.json, not part of the
                  npm-workspaces or Next.js build (see Dependency direction)
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

## Dependency direction

`app/` and `server/` depend on `lib/` and `db/`; `lib/` modules do not
import from `app/` or `server/`. Within `lib/`, `lib/providers.ts` is
deliberately dependency-free (no `db` import) because client components
import it directly for the AniList/MAL label constants — pulling `db` in
would drag the database into the client bundle.

`mobile/` may import from `src/lib/` (its dependency-free modules only —
`lib/library/filters.ts`, `lib/library/sort.ts`, `lib/schedule/group.ts`,
`lib/providers.ts`) but never from `src/app/`, `src/server/`, or `src/db/`.
It talks to the server only over the same `/api/*` HTTP surface the web app
uses, never by importing server code or querying the database directly.

## Testing layout

Tests are colocated as `*.test.ts` next to the module they cover (e.g.
`lib/nyaa/rss.test.ts`, `server/library-routes.test.ts`), run via Node's
built-in test runner (`node --experimental-strip-types ... --test`), not a
separate `tests/` tree. Fakes live in `lib/test-support/` (`db-stub.ts`,
`fetch-stub.ts`) and are imported by tests that need to avoid hitting a
real database or network.

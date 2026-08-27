# React Native (Expo) Client — Implementation Plan

Status: in progress. Scoped 2026-08-24. Phases 0–4 done (2026-08-27) — see
`context/progress-tracker.md`'s session log for what landed, including where
Phase 2 deviated from this document (SDK 57's `src/app/` router convention,
a separate eslint.config.js), where Phase 3 did (`Stack.Protected`
guards instead of an imperative redirect gate; a `@better-auth/core`
override to undo an npm version-skew; local per-screen styles rather than
pulling `ui/` forward from Phase 4), and where Phase 4 did (a fourth
Settings tab built early, no preview sheet on Search, non-pressable library
cards until Phase 5's detail screen exists). Phase 5 not started.

## Context

NekoStream today is a web app: Next.js 16 App Router pages rendered as
server components, a Hono API mounted at `/api`, and better-auth holding
the session in a cookie. Every screen is phone-shaped already — the
`SiteHeader` bottom tab bar, the 44px touch targets in `ui/button.tsx`,
the `env(safe-area-inset-*)` padding — but it is still a browser tab.

The ask is a native client for the same self-hosted server. The value is
the part the web app cannot do: opening a magnet link straight into a
torrent client, a real app icon on the home screen, and progress ticking
that survives a backgrounded browser tab.

This is deliberately a **second client against the existing API**, not a
rewrite and not a new backend. The server keeps one source of truth for
the library, the poller, and tracker sync.

### Scope gate — read this first

`context/functionality.md` is the scope-creep brake, and a mobile client
is **not** in its in-scope table. Worse, `project-overview.md` currently
lists "Aniyomi/Mihon (mobile app)" under alternatives with the reasoning
"it's a phone app, not something that runs unattended on a home server."

That reasoning does not actually rule this out — the server still runs
unattended; this adds a client to it — but the docs say what they say.
**Phase 0 updates those files before any code is written.** If the
operator does not want a mobile client in scope, the plan stops there
having cost nothing.

---

## The shape of the problem

Three findings from reading the codebase drive every decision below.

**1. Auth is cookie-only.** `requireSession` (`src/server/shared.ts:32`)
calls `auth.api.getSession({ headers })` and nothing else. There is no
bearer plugin, no JWT, no API key. The only non-cookie path in the whole
app is the Stremio token-in-URL scheme (`src/server/stremio-routes.ts:93`),
and that is scoped to Stremio's protocol shape.

**2. Several screens have no API behind them.** Pages are server
components that query Drizzle directly. Three pieces of data a mobile
client needs have no endpoint at all (detailed in Phase 1).

**3. The pure logic is already extractable.** `lib/library/filters.ts`,
`lib/library/sort.ts`, `lib/schedule/group.ts` and `lib/providers.ts` are
already dependency-free — `providers.ts` deliberately so, and
`filters.ts` carries a comment that its categories are shared "so the two
can't drift apart." A third client must not fork them.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | Expo (managed) + expo-router + TypeScript | expo-router's file tree maps 1:1 onto the existing route table; SecureStore and a custom scheme are both required |
| Distribution | EAS **dev build**, not Expo Go | `expo-secure-store` and a custom URL scheme need a real native binary |
| Auth | `@better-auth/expo` | Official plugin, keeps one session model; alternatives below |
| Repo layout | `mobile/` in this repo, own `package.json`, **not** an npm-workspaces restructure | Workspaces would move `src/`, breaking `Dockerfile`, `drizzle.config.ts` and the `@/*` alias for zero gain today |
| Code sharing | Metro `watchFolders` + a tsconfig path alias onto `../src/lib` | Shares the four pure modules without publishing a package |
| Server URL | Baked into `app.json`'s `extra.serverUrl`; the entry screen survives as a Settings override | **Revised 2026-08-27.** Originally "entered in-app on first launch" because every operator's `BETTER_AUTH_URL` differs — true, but there is one operator, and a build already knows its own server. Asking every install for an address it was built with was friction with nothing behind it. Omitting `extra.serverUrl` restores the first-launch screen for anyone else building this. |
| Styling | Plain `StyleSheet` + a `theme.ts` of the existing tokens | No Tailwind runtime; the palette is ~10 values and the app is dark-only |

### Auth, considered properly

`@better-auth/expo` stores the session cookie in `expo-secure-store` and
replays it. Verified against the plugin source and docs:

- Server: add `expo()` from `@better-auth/expo` to the plugins array in
  `src/lib/auth.ts:95`, and add `"nekostream://"` to the existing
  `trustedOrigins` array (`src/lib/auth.ts:80`).
- Client: `expoClient({ scheme, storagePrefix, storage: SecureStore })`.
- The client plugin intercepts `/get-session`, `/sign-out`,
  `/link-social`, and **any path matching `pathname.includes("/sign-in/")`**
  — which covers genericOAuth's `/sign-in/oauth2`. So
  `authClient.signIn.oauth2({ providerId: "anilist", callbackURL })` is
  expected to work unmodified.
- For the app's own `/api/*` calls, better-auth's documented pattern is
  `const cookies = await authClient.getCookie()` then
  `fetch(url, { headers: { Cookie: cookies }, credentials: "omit" })`.

**The known gap:** the plugin does *not* intercept genericOAuth's
`/oauth2/link` path, which is what "Link MyAnimeList" uses
(`src/components/oauth-button.tsx:54`). Handled in Phase 5.

**Provider consoles do not change.** AniList and MAL still redirect to
`{BETTER_AUTH_URL}/api/auth/oauth2/callback/{provider}`; better-auth then
redirects on to the app scheme. No new OAuth app registration.

Alternatives rejected: a bearer/JWT plugin (a second session model to keep
correct, for no benefit over the official path); a Stremio-style opaque
token (would need its own issuance UI and would sit outside better-auth's
session lifecycle entirely).

---

## Phase 0 — Scope and docs ✅ done 2026-08-27

No code. Land this first so the rest is in-scope by the project's own rules.

- `context/functionality.md` — add an in-scope row for the mobile client,
  stating it is a client against the existing API with no server-side
  behaviour of its own. Add out-of-scope rows for push notifications
  (email stays the one channel per the existing row) and offline mutation
  queueing.
- `context/project-overview.md` — correct the Aniyomi/Mihon alternative
  entry so it no longer implies a phone app is out of scope.
- `context/architecture.md` — note `mobile/` in the folder layout and the
  dependency rule that it may import from `src/lib/` but never from
  `src/app/`, `src/server/` or `src/db/`.

**Verify:** the three files agree with each other and with this plan.

---

## Phase 1 — Close the API gaps ✅ done 2026-08-27

Server-only, shippable on its own, and useful to the web app too. Every
route uses `requireSession`, `handleUpstreamErrors`, `parseBody` /
`parseParam` and `requireEntry` from `src/server/shared.ts` — per
`AGENTS.md`, none of these get reimplemented.

### 1a. Linked providers + first-sync state

The biggest gap: nothing tells a client which trackers are linked.
`src/app/settings/page.tsx:37` and `src/app/settings/mirror/page.tsx:13`
both call `auth.api.listUserAccounts({ headers })` directly, and
`src/app/anime/[id]/page.tsx` queries the `account` table for
`providerId = "mal"` to gate the tracker editor.

Extend the existing `GET /api/settings` response rather than adding a
route — it is already "the user's account-level state", and one call then
serves the settings screen, the mirror gate and the detail-page gate.

```
GET /api/settings  ->  {
  notificationEmail: string | null,
  notifyNewEpisodesByEmail: boolean,
  emailConfigured: boolean,
  anilistLinked: boolean,        // new
  malLinked: boolean,            // new
  anilistSyncedAt: string | null // new, ISO — null means never synced
}
```

`anilistSyncedAt` drives the first-run import banner that
`src/app/page.tsx` currently reads straight off the `user` row.

File: `src/server/settings-routes.ts`. `PATCH` keeps its current response
shape plus the same three fields, so the client can treat both as one type.

### 1b. Schedule endpoint

`src/app/schedule/page.tsx:15` joins `libraryEntry` with `rssFilter`
filtered to `nextAiringAt IS NOT NULL`, ordered ascending, projecting a
`hasFeed` boolean. `GET /api/library` returns entries but not `hasFeed`,
and reconstructing it client-side costs one `/:id/filter` call per entry.

```
GET /api/library/schedule  ->  { entries: ScheduleItem[] }
```

`ScheduleItem` mirrors what the page already builds today. Declare the
route **before** the `/:id` routes in `src/server/library-routes.ts` —
Hono matches in declaration order, which is why `/stremio-token` and
`/sync` already sit above `/:id` (`library-routes.ts:110`).

Then refactor `src/app/schedule/page.tsx` to call the same query helper,
so the web page and the endpoint cannot drift.

### 1c. Trust the app's origin

`src/lib/auth.ts:80` — add the app scheme to `trustedOrigins` and register
the `expo()` server plugin. Env-driven via `lib/env.ts`'s Zod schema
(`MOBILE_APP_SCHEME`, optional, using the existing
`z.preprocess((v) => v || undefined, ...)` pattern for Compose's empty
strings). Never `process.env` directly.

**Verify:** `npm run typecheck && npm run lint && npm test`. Add
`src/server/settings-routes.test.ts` covering the three new fields, and a
schedule-route test covering `hasFeed` and the `nextAiringAt IS NULL`
exclusion, using `lib/test-support/db-stub.ts`. Curl each endpoint with
and without a session cookie; confirm 401 shape is unchanged.

---

## Phase 2 — Scaffold `mobile/` ✅ done 2026-08-27

**Deviations from the tree below, forced by the actual SDK 57 scaffold**
(`AGENTS.md`'s own instruction is to read the versioned docs before writing
code — SDK 57 turned out to have moved past what this plan assumed):
- Routes live in `mobile/src/app/`, not top-level `mobile/app/` —
  `create-expo-app@latest`'s current default template puts them there, and
  `@/*` already points at `./src/*` in the generated tsconfig, matching the
  root web app's own `@/*` → `./src/*` convention. Fighting that to match
  this document's tree literally would mean working against expo-router's
  auto-detection for no real benefit.
- `mobile/` did **not** join the root `eslint.config.mjs` — it has its own
  `mobile/eslint.config.js` (`eslint-config-expo/flat`), and the root
  config now ignores `mobile/**`. A shared flat config across a Next.js web
  app and a React Native app (different globals, different type-aware
  project wiring) wasn't worth the coupling. `mobile/`'s config is **not**
  type-aware yet (no `parserOptions.project`), so `no-floating-promises`
  isn't enforced there — revisit once Phase 3+ adds real async call sites.
- Root `tsconfig.json` gained `"mobile"` in its `exclude` array — without
  it, the root `tsc --noEmit` swept up `mobile/`'s files under the *web
  app's* compiler options (DOM lib, different `@/*` target) and broke.
- The demo scaffold's `NativeTabs`/`unstable-native-tabs`,
  `react-native-reanimated`-driven splash animation, and `@expo/ui`/
  `expo-glass-effect`/`expo-symbols` liquid-glass demo were deleted rather
  than adapted — Phase 4's tab bar should use the stable `Tabs` from
  `expo-router`, not the `unstable-*` native tab API, for a self-hosted
  single-operator app.

Verified end-to-end: `npx tsc --noEmit`, `npx eslint .`, and — since
`expo start` itself is an interactive dev server unsuited to a one-shot
check — `npx expo export --platform web` and `--platform android` both
bundled cleanly, and the output was grepped to confirm the `@shared/*`
import's actual content (not just its type) made it into the bundle. Root
`npm run typecheck && npm run lint && npm test` still green afterward.

```
mobile/
  app.json                 scheme: "nekostream", bundle ids
  eas.json                 development / preview profiles
  metro.config.js          watchFolders -> ../src/lib
  babel.config.js          module-resolver: makes @shared/* resolve at
                           bundle time, not just under tsc — see below
  eslint.config.js          own flat config (eslint-config-expo), not the
                           root's — see the Phase 2 deviations above
  tsconfig.json            paths: @/* -> ./src/*, @shared/* -> ../src/lib/*
  package.json
  src/
    app/                   expo-router root — SDK 57's default location,
                           not top-level app/, see the deviations above
      _layout.tsx           SafeAreaProvider, theme, auth gate
      index.tsx              Phase 2: debug health-check screen. Becomes
                             the auth-gated redirect once Phase 3 lands.
      server-url.tsx         first-launch server entry (Phase 3)
      login.tsx              (Phase 3)
      (tabs)/                4 tabs, matching SiteHeader (Phase 4) — use
                             expo-router's stable Tabs, not NativeTabs
        _layout.tsx
        index.tsx            Library
        schedule.tsx
        search.tsx
        settings.tsx
      anime/[id].tsx          (Phase 5)
      settings/mirror.tsx     (Phase 5)
    api/
      client.ts             apiRequest/apiSend, ported (done) — baseUrl and
                             auth-header seams left for Phase 3 to fill in
      types.ts               response types mirroring the routes, grown
                             per-phase as screens start calling endpoints
    auth/
      client.ts             createAuthClient + expoClient (Phase 3)
      server-url.ts          read/write/validate the base URL (Phase 3)
    theme.ts                the design tokens, ported from globals.css (done)
    ui/                     Button, Input, Badge, Sheet, Switch,
                            AnimeGrid, AnimePoster, Wordmark (Phase 4+)
    components/             screen-level components (Phase 4+)
```

### Metro + shared modules

```js
// mobile/metro.config.js
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../src/lib")];
```

Pitfalls, in the order they will bite:

1. Metro does not follow paths outside the project root unless they are in
   `watchFolders`. Adding the alias without the watch folder fails at
   bundle time, not typecheck time.
2. Only genuinely RN-safe modules may be shared. `filters.ts`, `sort.ts`,
   `group.ts` and `providers.ts` qualify. `sort.ts` and `group.ts` use
   `Intl.Collator` / `Intl.DateTimeFormat` — **Hermes needs
   `jsc-intl`/`hermes-intl` enabled, or these silently collate wrong on
   Android.** Verify early; if it is a problem, pass a comparator in
   rather than forking the module.
3. Never share anything that transitively imports `db`, `next/*` or DOM
   types. `providers.ts`'s dependency-free rule now protects two clients.

### API client ✅ done 2026-08-27

Ported `src/lib/client/request.ts` (`mobile/src/api/client.ts`) — the
`ApiResult<T>` discriminated union verbatim, `UNREACHABLE` branch and all.
Base-URL prefixing is done now (`setBaseUrl`/`getBaseUrl`); the cookie
attachment isn't — Phase 3 doesn't exist yet, so there's no `authClient` to
call `.getCookie()` on. Left a `setAuthHeadersProvider()` seam instead (a
no-op by default) for Phase 3 to fill in, rather than leaving a broken
import to a module that doesn't exist yet.

**Verify:** confirmed — see "Verified end-to-end" above. The literal
`npx expo start builds` check wasn't run as written (that starts an
interactive dev server with no exit, unsuited to a one-shot check);
`npx expo export` for both platforms is the non-interactive equivalent and
was used instead. The debug screen (`src/app/index.tsx`) exists and calls
`GET /api/health` via `apiRequest`, ready to check against a live server —
not run against one this session (see the progress-tracker note on why).

---

## Phase 3 — Server URL + auth ✅ done 2026-08-27

The client cannot know the server at build time, and `createAuthClient`
takes its `baseURL` at construction.

What landed:
- `auth/server-url.ts` — validate (`GET /api/health` → `service:
  "nekostream"`) / persist (AsyncStorage, key `nekostream:server-url`) /
  read the base URL, with a synchronous module cache (`getServerUrl()`)
  that `loadServerUrl()` primes at startup. `normalizeServerUrl()` assumes
  `http://` when no scheme is typed (the LAN-address case).
- `auth/client.ts` — `getAuthClient()` builds the `@better-auth/expo`
  client **lazily** and rebuilds it if the server URL changed; wires
  `setAuthHeadersProvider` to `client.getCookie()` so `api/client.ts`
  attaches the session cookie.
- `auth/context.tsx` (a deviation — the plan's tree had no context file):
  `<AuthProvider>` owns the whole gate as a `status` of
  `loading | no-server | no-session | ready`, plus `setServer` / `signIn`
  (`signIn.oauth2({ providerId: "anilist", callbackURL: "/" })`) /
  `signOut` / `changeServer`. Session is managed imperatively, not via the
  client's `useSession` hook, because the client is rebuilt on URL change.
- `app/server-url.tsx`, `app/login.tsx` (mirrors web `/login`),
  `app/index.tsx` (was the Phase 2 debug screen; now the authed landing
  placeholder until Phase 4's `(tabs)` redirect).
- `app/_layout.tsx` — the gate, as three mutually-exclusive
  `<Stack.Protected guard={status === ...}>` branches (SDK 57's recommended
  pattern) rather than a manual `router.replace`. Replaces the per-page
  `getSession` + `redirect` every web page repeats.

Deviations / notes:
- **npm version skew.** A fresh `mobile/` install pulled
  `@better-auth/core@1.7.2` (via `@better-auth/expo`'s `^` range) alongside
  `better-auth@1.6.25`'s pinned `1.6.25`, which broke the client-plugin
  types. Fixed with a `"overrides": { "@better-auth/core": "1.6.25" }` in
  `mobile/package.json`, matching the root install.
- `@better-auth/expo@1.6.25`'s `expoClient()` still doesn't structurally
  satisfy `better-auth@1.6.25`'s `BetterAuthClientPlugin` (`getActions`
  arity), so it's cast to that type at the one call site. Runtime contract
  is exactly the documented one; revisit the cast on the next bump.
- No `ui/` primitives yet — three screens with local `StyleSheet`. Phase 4
  builds `ui/` and these get folded in.

**Verify:** typecheck + lint clean; `expo export` bundles cleanly for
android and web (1523 / 1056 modules), all three routes render. **Not yet
run on a device** (needs an EAS dev build + a live server): cold install →
enter URL → AniList consent in the system browser → deep link back →
session persists across a force-quit; then sign out and confirm SecureStore
is cleared. `MOBILE_APP_SCHEME=nekostream://` must be set on the server for
the deep-link redirect to pass the origin check.

---

## Phase 4 — Library, schedule, search ✅ done 2026-08-27

The three read-mostly tabs. Shippable as a usable read-only app.

- **Library** — `GET /api/library`. `FlatList` `numColumns={2}`, posters
  at `aspectRatio: 2/3`. Filter chips from the shared `FILTERS`; sort from
  the shared `SORTS`, persisted to AsyncStorage under the same
  `nekostream:library-sort` key the web app uses
  (`library-grid.tsx:53`). Pull-to-refresh calls `POST /api/library/sync`.
  Show the first-run banner when `anilistSyncedAt` is null.
- **Schedule** — `GET /api/library/schedule`, grouped by the shared
  `groupByDay(entries, new Date())`. Port the two-layer `EpisodeBar`
  (accent = watched, amber = aired-unwatched) and the `latestAired`
  derivation from `schedule-list.tsx`; that is the screen's whole point.
- **Search** — `GET /api/anilist/search?q=&page=`, 350ms debounce as in
  `search-browser.tsx:40`, marking entries whose `anilistMediaId` is
  already in the library list. `POST /api/library` to add.

Note: JSON serialises the `timestamp` columns as ISO strings. Parse them
back to `Date` at the API boundary in `api/types.ts` — the shared sort and
grouping helpers take real `Date` objects.

### Deviations from the above

- **A fourth tab, Settings, shipped early.** The tab bar matches
  `SiteHeader`'s four destinations, and Phase 3's sign-out / change-server
  controls lived on the placeholder `app/index.tsx` that `(tabs)` replaces.
  Leaving them unreachable for a whole phase would be a regression, so
  `(tabs)/settings.tsx` exists now with account + server + those two
  actions. Everything else on it — notification email, Stremio, the MAL
  link — is still Phase 5, and it makes no `/api/settings` call yet.
- **`app/index.tsx` was deleted rather than turned into a redirect.** Both
  it and `(tabs)/index.tsx` resolve to `/`, so keeping both would be a route
  collision. The gate's ready branch is now `<Stack.Screen name="(tabs)" />`.
- **The first-run banner is driven by the sync request's own state, not by
  `anilistSyncedAt`.** The banner the web renders comes from `AniListSync`'s
  request state; `anilistSyncedAt` only seeds its initial value there. Since
  the import fires on launch here anyway, reading the flag would have cost a
  second `/api/settings` round trip to compute something the request already
  reports. `anilistSyncedAt` is still typed in `api/types.ts` for Phase 5.
- **Pull-to-refresh does not pass `force=1`.** The plan says it calls
  `POST /api/library/sync`, which it does — unforced, so the server's
  five-minute throttle still applies. Forcing on every pull would hammer
  AniList for no gain; the local library reloads either way.
- **Library cards are not pressable.** They open the Phase 5 detail screen,
  which does not exist — and with `typedRoutes` on, an `/anime/[id]` href
  would not even typecheck. Phase 5 adds the route and the press handler
  together.
- **No preview sheet on Search.** The web's exists so a title that isn't in
  the library still has somewhere to show its synopsis; on a phone that is
  what the Phase 5 detail screen is for. Phase 4 shipped the part that
  changes the library — the Add button.
- **New primitives beyond the tree above:** `ui/screen.tsx` (the shared
  safe-area frame, title block, loading and empty states) and
  `ui/option-sheet.tsx` (a Modal-based single-choice list — what the web's
  `<select>` for sort order becomes). `api/use-resource.ts` holds the
  load-on-focus/pull-to-refresh pattern the three data tabs share; the focus
  refetch is this app's `router.refresh()`, which is why adding a title on
  Search shows up on Library with no cross-screen wiring.
- **One new dependency:** `@expo/vector-icons` for the tab bar glyphs — see
  `context/tech-stack.md`'s mobile matrix.

**Verify:** typecheck + lint clean in `mobile/`; `expo export` bundles
cleanly for android and web, and the Android bundle was grepped for strings
that exist only inside the shared `sort.ts` and `group.ts` to confirm the
`@shared/*` imports resolve at bundle time, not just under `tsc`. Root
`typecheck`/`lint`/`test` (97/97) still green. **Not yet run against a live
server or on a device** — the side-by-side check below is still outstanding:
same counts per filter tab, same sort order, same day grouping as the web
app on the same account.

---

## Phase 5 — Detail, progress, episodes, settings

Where the writes live.

- **Detail** — `GET /api/library/:id/episodes`,
  `GET /api/library/:id/filter`, `GET /api/anilist/media/:id` for
  description/genres. Port `ProgressProvider`'s optimistic update with
  revert-on-failure (`progress-control.tsx:52`) as a React context
  unchanged — it already has no DOM dependency — and render the returned
  `SyncOutcome[]` so a MAL failure is visible without blocking AniList.
- **Episodes** — `Linking.openURL(magnetUri)`. This is the feature that
  justifies the app.
- **Nyaa filter** — discover → pick group/quality → `PUT .../filter`.
  `confirm()` becomes `Alert.alert` with a destructive button.
- **Tracker editor** — port `use-tracker-entry.ts` as-is; it is plain
  hooks plus `apiRequest`. Keep its "seed from the highest progress"
  rule and its deliberately sequential saves.
- **Settings** — `GET/PATCH /api/settings`, now including link status.
  Stremio: `expo-clipboard` for the URL, `Linking.openURL` for
  `stremio://`, rotate behind an `Alert`.
- **MAL linking (the known gap).** `@better-auth/expo` does not intercept
  `/oauth2/link`. Do it manually: `WebBrowser.openAuthSessionAsync` with
  an absolute `callbackURL` of `nekostream://settings`, which better-auth
  permits because the scheme is in `trustedOrigins` from Phase 1c. If
  that fails, fall back to opening `/settings` on the server in a browser
  and having the user link there — the session is shared, so it works,
  it is just less pleasant. Do not block the phase on it.
- **Mirror** — port the `idle → scanning → reviewing → applying → done`
  machine from `mirror-review.tsx`, keeping rows defaulting to `"skip"`.
  Lowest priority; it is a rare desk-bound task.

**Verify:** tick progress on the phone, confirm it lands on AniList and
MAL and matches the web app after refresh. Open a magnet and confirm the
OS hands it to a torrent client. Save a Nyaa filter and confirm the
poller arms it (check `rss_filter.pollNextAt`).

---

## Risks, most likely first

| Risk | Mitigation |
|---|---|
| `Intl` under Hermes collates or formats wrong, silently | Test `sortEntries` and `groupByDay` on a real Android device in Phase 2, before any screen depends on them |
| `authClient` constructed eagerly with a stale base URL | Lazy getter, recreate on change — called out in Phase 3 |
| MAL linking via `/oauth2/link` is not intercepted | Manual `openAuthSessionAsync`; documented web fallback |
| Metro can't resolve `../src/lib` | `watchFolders` + alias together; smoke-test the import in Phase 2 |
| Self-signed cert / plain-http LAN server | Android needs a network security config for cleartext; document it, and recommend the operator's existing `PUBLIC_URL` https origin |
| Cookie expiry mid-session | `apiRequest` already surfaces 401 as a result, not a throw; route 401 to the login gate centrally |
| The two clients' filter/sort logic drifts | Shared modules, not copies — the reason for the Metro setup |
| `mobile/` lint/format drifts from the root config | Extend the root `eslint.config.mjs` and reuse `.prettierrc` |

## Explicitly out of scope

Offline mutation queueing, push notifications (email remains the one
channel — see `functionality.md`), a tablet layout, iOS App Store or Play
Store distribution, and any change to the poller or to tracker sync.

---

## Verification summary

```bash
# Server (root)
npm run typecheck && npm run lint && npm test
npm run build

# Mobile
cd mobile && npx tsc --noEmit && npx expo start
npx eas build --profile development --platform android
```

End-to-end, on a device against a real deployment: install → enter server
URL → sign in with AniList → library matches the web app → open a magnet
→ tick progress → confirm on AniList and MAL.

## Docs to update when this lands

- `context/functionality.md` — Phase 0, before any code.
- `context/project-overview.md` — Phase 0.
- `context/architecture.md` — `mobile/` layout and its dependency rule.
- `context/tech-stack.md` — Expo/expo-router/SecureStore/`@better-auth/expo`
  in the matrix, and bump the verified date.
- `context/user-flow.md` — the new endpoints from Phase 1 in the API table.
- `context/progress-tracker.md` — session log, plus a decision-log row for
  choosing `@better-auth/expo` over a bearer token and `mobile/` over npm
  workspaces.
- `README.md` — the app scheme env var, and the `PUBLIC_URL`/TLS note as
  it applies to a phone on the LAN. While in there, fix the stale "How it
  works" line about scheduled polling that `functionality.md` already
  flags.

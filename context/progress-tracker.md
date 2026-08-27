# Progress Tracker

The most-updated file in this set. If this looks stale, everything else in
`context/` should be treated as suspect too.

## Current status (as of 2026-08-27)

Past the initial build. Day-to-day development still proceeds as a series of
small, complete features on `main` — but one genuinely large, multi-session
feature is now in progress: a React Native (Expo) mobile client, scoped in
`planning/PLAN.md`. Phases 0–4 are done — scope/docs, the API gaps it
needs, scaffolding `mobile/`, server-URL entry + `@better-auth/expo` auth
with the app-entry gate, and now the four-tab shell with Library, Schedule
and Search reading real data. Phase 5 (the write screens — detail, progress,
episodes/magnets, the full settings screen, mirror) has not started. See
`planning/PLAN.md` for the phase breakdown and where Phases 2–4 deviated
from it (SDK 57 moved past what the plan assumed; Phase 3 used
`Stack.Protected` guards and needed an npm `overrides` pin; Phase 4 shipped a
Settings tab early and left library cards non-pressable until the detail
screen exists).

**Nothing in `mobile/` has run on a device or against a live server yet.**
Every phase so far has been verified by typecheck, lint and `expo export`
only. That gap is the single biggest risk carried into Phase 5 — see the
open items below.

All core functionality in `functionality.md`'s "in scope, and shipped"
table is live in production (Docker on a Raspberry Pi 5, per `README.md`).

## Recently shipped (most recent first)

- **Stop tracking a Nyaa feed** (`d127f1d`) — delete the saved `rss_filter`
  row from the detail page instead of only changing state via the poller.
- **Calendar page + email notifications finished** (`386cf1b`, `a2f122f`,
  `2896`) — `/calendar`, the poller-triggered notification email, and a
  current-time indicator on the calendar so aired-vs-upcoming is visually
  obvious.
- **Docker deploy cleanup** (`8d8ea1b`) — dropped a redundant `public/` copy
  from the image.

## Decision log

Decisions made during implementation that aren't written down elsewhere,
with reasoning:

| Decision | Reasoning | Date |
|---|---|---|
| Poller runs in-process (`setInterval` in the Next.js server), not a separate worker/cron | Single-container deployment target (Raspberry Pi, Docker Compose); a second process would need its own coordination with no benefit at this scale. **Constraint:** do not run more than one container instance against the same database — see `architecture.md`. | pre-Aug 2026 |
| Notification email address is a separate, hand-entered field (`user.notificationEmail`), not the account's OAuth email | AniList and MAL never return a real email — the `email` column holds a synthesized `id@provider.local` placeholder that can't receive mail. | Aug 7, 2026 (`2847`) |
| Calendar shows one upcoming episode per show, not a multi-week grid | The schema only stores the single next-airing pair per entry; a real calendar grid needs a schema change, deliberately deferred. | Aug 7–8, 2026 |
| Email notification test regex bug | Test failure traced to a case-sensitive regex; fixed to match case-insensitively. Recorded here because it was a real bug, not a flaky test. | Aug 7, 2026 (`2859`–`2860`) |
| Mobile auth via `@better-auth/expo`, not a bearer/JWT plugin or a Stremio-style opaque token | Keeps one session model instead of a second one to keep correct; it's the officially supported Expo path and stores the session in `expo-secure-store`. A bearer plugin would duplicate the cookie session for no benefit; an opaque token would need its own issuance UI and would sit outside better-auth's session lifecycle entirely. | Aug 27, 2026 |
| `mobile/` as its own `package.json` in this repo, not an npm-workspaces restructure | Workspaces would move `src/`, breaking `Dockerfile`, `drizzle.config.ts` and the `@/*` alias for zero gain today. Metro's `watchFolders` + a `tsconfig` path alias share the four pure `lib/` modules without publishing a package. | Aug 27, 2026 |
| Extended `GET/PATCH /api/settings` with `anilistLinked`/`malLinked`/`anilistSyncedAt` rather than adding a new route | It's already "the user's account-level state"; one call now serves the settings screen, the mirror gate, and the detail-page tracker-editor gate, which each ran their own `listUserAccounts`/`account` query before. | Aug 27, 2026 |
| `mobile/`'s expo-router root is `mobile/src/app/`, not top-level `mobile/app/` as `planning/PLAN.md` originally specced | `create-expo-app@latest`'s current (SDK 57) default template puts it there, with `@/*` already pointing at `./src/*` — matching the root web app's own `@/*` convention exactly. Fighting the template's auto-detection to match the plan document literally wasn't worth it; the plan's tree was updated to match. | Aug 27, 2026 |
| `mobile/` has its own `eslint.config.js` (`eslint-config-expo/flat`), not a shared/extended root `eslint.config.mjs` | A Next.js web app and a React Native app have different globals and different type-aware-linting wiring; root's config now ignores `mobile/**` and root's `tsconfig.json` excludes `mobile` (without that exclude, root `tsc --noEmit` swept up `mobile/`'s files under the web app's DOM-lib compiler options and broke). **Known gap:** `mobile/`'s config isn't type-aware yet, so `no-floating-promises` isn't enforced there — revisit once Phase 3+ adds real async call sites worth protecting. | Aug 27, 2026 |
| Deleted the SDK 57 template's `NativeTabs`/`unstable-native-tabs`, reanimated-driven splash, and `@expo/ui`/`expo-glass-effect`/`expo-symbols` demo rather than adapting them | Building a self-hosted single-operator app's real tab bar (Phase 4) on an API whose own package export is named `unstable-*` is the wrong foundation; the stable `Tabs` from `expo-router` is the same job with none of that risk. | Aug 27, 2026 |
| `mobile/package.json` pins `@better-auth/core` to `1.6.25` via `overrides` | A fresh `mobile/` install resolved `@better-auth/core@1.7.2` through `@better-auth/expo`'s `^` range while `better-auth@1.6.25` pins its own copy to `1.6.25`; the two-copy skew broke `BetterAuthClientPlugin` type compatibility. The override forces one copy, matching the root install. Re-check on any `better-auth` bump. | Aug 27, 2026 |
| `mobile/`'s tab bar imports `Tabs` from `expo-router/js-tabs`, not from `expo-router` | SDK 57 deprecated the top-level re-export (`@deprecated Use 'expo-router/js-tabs'` in its own `exports.d.ts`), and `AGENTS.md`'s standing rule is to heed deprecation notices. Still deliberately not `expo-router/unstable-native-tabs` — see the Phase 2 row above. | Aug 27, 2026 |
| Added `@expo/vector-icons` rather than `lucide-react-native` for the tab bar, even though the web uses `lucide-react` | `lucide-react-native` needs `react-native-svg`, a native module, which widens the dev-build surface for four glyphs. `@expo/vector-icons` is font-based and adds no native module, and its `Feather` set is the set lucide was forked from — so the two clients' tab bars stay recognisably the same icons. | Aug 27, 2026 |
| The three data tabs share `api/use-resource.ts`, which refetches on screen focus | It is this app's `router.refresh()`. The web calls that after adding a title so the library page re-renders; here Search and Library are separate screens with no shared store, and a focus refetch means neither has to know the other exists. Refetch-on-focus is silent by design — only a pull-to-refresh shows a spinner. | Aug 27, 2026 |
| Library's first-run banner reads the sync request's own state, not `anilistSyncedAt` from `GET /api/settings` | Functionally identical — the web's banner is `AniListSync`'s request state too, and `anilistSyncedAt` only seeds its initial value there. Since the import fires on launch on mobile anyway, reading the flag would cost a second round trip to compute what the request already reports. The field stays typed in `api/types.ts` for Phase 5's settings screen. | Aug 27, 2026 |
| The server URL is baked into `mobile/app.json`'s `extra.serverUrl`; the entry screen became a Settings-only override | Reverses Phase 3's "entered on first launch". The original reasoning — every operator's `BETTER_AUTH_URL` differs — is true but irrelevant at one operator: the build already knows its server, so asking for it on every install bought nothing. `no-server` is now reached only deliberately (`changeServer()`), tracked as its own `changingServer` flag rather than inferred from an empty URL, since with a default there is never an empty URL. Drop `extra.serverUrl` from app.json and the first-launch flow returns unchanged — which is what any other operator building this gets. | Aug 27, 2026 |
| Phase 3 gate is three `<Stack.Protected>` guards, not an imperative `router.replace` in `_layout.tsx` | It's the SDK 57 docs' recommended auth pattern: expo-router redirects to whichever branch's `guard` is true when `useAuth().status` changes, so sign-in / sign-out / change-server flip screens with no navigation code. Session is tracked imperatively (getSession/signIn/signOut) rather than the client's `useSession` hook because `getAuthClient()` is rebuilt when the server URL changes. | Aug 27, 2026 |

## Open items

**Mobile client — carried into Phase 5:**
- **BLOCKED ON A DEPLOY: the Pi runs a pre-Phase-1 build, so the app cannot
  sign in.** Confirmed on device (Aug 27), not just inferred: a `preview`
  APK on a real Android 16 phone validated `https://nyaa.haruhadj.org`
  through `/api/health`, persisted it, advanced the gate to the login
  screen — and then failed the AniList sign-in with **"Invalid
  callbackURL"**. That is better-auth rejecting `nekostream://` because it
  is not in `trustedOrigins`, and it cannot be: `main` has no
  `MOBILE_APP_SCHEME` in `lib/auth.ts` (nor `getScheduleEntries` in
  `library-routes.ts`) — both landed in `2541cd0` on
  `mobile-client/phase-0-1-groundwork`, which has never been merged.
  **Unblocking takes three steps, in order:** merge that branch to `main`;
  redeploy the Pi; add `MOBILE_APP_SCHEME=nekostream://` to its Compose env
  and restart. Until then the Schedule tab will also 404.
- **The rest of the device pass is still unrun**, because sign-in gates it:
  AniList consent → deep link back → force-quit → session persists; then the
  Phase 4 side-by-side — same counts per filter tab, same sort order, same
  day grouping as the web app on the same account.
- Beware `adb exec-out screencap` on this device: it returned an all-black
  frame while the app was rendering normally. `uiautomator dump` showed the
  real view tree. Trust the hierarchy over the screenshot when they disagree.
- **`Intl` under Hermes is still unverified.** `planning/PLAN.md`'s top risk
  says to test `sortEntries` and `groupByDay` on a real Android device
  "before any screen depends on them" — as of Phase 4 the Library and
  Schedule tabs both do. If titles collate oddly or day labels come out
  wrong on Android, this is the first thing to check; the documented fallback
  is passing a comparator in rather than forking the shared module.
- `mobile/`'s eslint config still isn't type-aware, so `no-floating-promises`
  isn't enforced there. Phase 4 added plenty of async call sites, so the
  reason to revisit this is now real. Every `void`-prefixed promise in
  `mobile/src/` is deliberate; nothing enforces that it stays that way.
- Library cards don't open anything — the Phase 5 detail screen and the press
  handler land together.

**Verify-during-implementation (not blocking, but worth checking next time
this area is touched):**
- `README.md`'s "How it works" section still claims scheduled polling
  "is deliberately not implemented yet" — it is implemented
  (`lib/airing/poller.ts`). Fix the README line the next time anyone edits
  that section (see `functionality.md`).
- An untracked, empty file named `0` sits at the project root (`git status`
  shows `?? 0`). Per session memory (`2888`, Aug 8) this was created by
  accident during a previous session. Not cleaned up here since it's
  outside this session's scope — worth deleting or asking the operator
  about the next time root-level files are touched.
- `library-routes.test.ts` has an unhandled error that doesn't fail the
  test suite (`2915`, Aug 8) — worth tracking down so a real regression in
  that area doesn't hide behind the same non-failure.
- Package manifest has ES module configuration warnings (`2916`, Aug 8) —
  not urgent, but should be resolved rather than accumulating.

**Watch:** email notification delivery was under active debugging as of
Aug 8 morning (session `S318`) — poller logic and env validation checked
out, root cause traced to "zero feeds armed" because tracked shows' next
episodes were still days out, not a code bug. If email reports of "not
sending" recur, check `pollNextAt`/armed-feed state before re-auditing the
mailer.

## Session log

Two lines per session: what happened, what's next.

- **2026-08-01** — Merged `chore/cleanup` to `main`, deployed. Began
  calendar + email notification design (scheduled-polling model, config
  gated by whether a Nyaa feed is saved). Next: build the calendar UI and
  wire the poller to send mail.
- **2026-08-07** — Calendar list/page/nav shipped; fixed a React key
  warning and a case-sensitive regex in the email test; production build
  and dev server verified; noticed the DB schema was ahead of applied
  migrations. Deployed to Docker with SMTP configured in Compose and the
  production SQLite volume backed up first. Added a visible current-time
  indicator to the calendar per a same-day follow-up request. Next: verify
  email actually sends in production.
- **2026-08-08 (morning)** — Investigated why no notification email had
  gone out; traced to no feeds currently being armed (tracked shows' next
  episodes were days away), not a bug. Wrote a CLAUDE.md pointer. Shipped
  "stop tracking" (DELETE the saved `rss_filter`). Next: this blueprint
  retrofit (`AGENTS.md` + `context/`), so future sessions stop re-deriving
  this architecture from scratch.
- **2026-08-13 (late night)** — Renamed the calendar route from `/calendar`
  to `/schedule` to match the nav label (already "Schedule"); the page and
  URL had lagged the rename. Updated `SiteHeader`'s `Tab` type and links,
  and doc references in README/functionality/user-flow/architecture. Left
  `lib/calendar/` and the `calendar-list.tsx`/`CalendarList` component
  names as-is — only the route path was out of sync, not the internals.
  Follow-up same night: per an explicit ask to remove all "calendar"
  naming, went further — `lib/calendar/` → `lib/schedule/`
  (`CalendarEntry`/`CalendarGroup` → `ScheduleEntry`/`ScheduleGroup`),
  `calendar-list.tsx` → `schedule-list.tsx` (`CalendarItem`/`CalendarList`
  → `ScheduleItem`/`ScheduleList`), `CalendarPage` → `SchedulePage`, plus
  the remaining doc references (functionality/architecture/README/
  user-flow). Deliberately left: lucide-react's `CalendarDays` icon import
  (third-party symbol, not app naming) and this file's dated historical
  log entries above (accurate record of what the feature was called at
  the time). typecheck/lint/test all green after the rename.
- **2026-08-21** — Added AniList/MyAnimeList links to the anime detail page:
  pill links beside the genres, pointing at each tracker's own page for the
  show (`anilist.co/anime/:id`, `myanimelist.net/anime/:id`). URL builders
  live in `lib/providers.ts` next to `PROVIDER_LABEL` — the hostnames are
  tracker facts, so they belong where the trackers are named once. The MAL
  link is omitted when `malMediaId` is null (AniList had no MAL mapping).
  typecheck/lint/test green.
- **2026-08-21 (later)** — Made the watched-vs-aired gap the schedule card's
  main signal: a two-layer `EpisodeBar` (accent = watched, amber behind it =
  aired and unwatched, scaled to `totalEpisodes` or to the aired count when
  the season length is unknown), an explicit `Ep 5 watched / Ep 7 aired`
  ledger that collapses to "Caught up" when there's no backlog, an amber card
  border when behind, and a filled/hollow dot marking aired vs upcoming on the
  air-time row. `latestAired` is derived as `nextAiringEpisode` once its air
  time has passed and `nextAiringEpisode - 1` before — the poller only advances
  the row when AniList announces the following episode, so the row's episode
  doubles as the latest aired one. Backlog is clamped at 0 since a tracker can
  sit ahead of AniList's airing data. typecheck/lint/test green.
- **2026-08-21 (evening)** — Promoted the tracker links from muted 11px pills
  to real buttons in `components/tracker-links.tsx`: official AniList/MyAnimeList
  marks (simple-icons path data, CC0, inlined as SVG rather than adding an icon
  dependency), brand-tinted background and border, built on `buttonVariants()`
  — the helper that already existed for links styled as actions. MAL's navy
  (#2E51A2) is unreadable on zinc-950, so its mark uses a lightened #5C7EDB.
  Moved the row out of the narrow column beside the cover to full width below
  the header block, so both buttons sit on one line at phone width instead of
  stacking and pushing the progress card down. typecheck/lint/test green.
- **2026-08-23** — Gave the project a real logo. Extracted the cat-and-play
  mark from the source paste in `public/`, removing the card background by
  alpha-from-luminance (the strokes keep their blue→purple gradient) into a
  transparent `public/logo.png`; `src/app/icon.png` and `apple-icon.png` place
  it on a rounded dark plate via Next's file conventions. `ui/wordmark.tsx`
  now shows the mark at 24px in place of the accent dot, so it carries into
  the header and the login eyebrow. The Dockerfile had deliberately skipped
  `public/` ("the app serves no static assets of its own"), which 404'd
  `/logo.png` in the container — restored the COPY, and added the source
  screenshots to `.dockerignore` so they stay out of the image. Also fixed
  search-result cards drifting out of alignment once results wrap to a second
  row: a short title or a missing format/year left a card shorter and floated
  its Add button up, so the `<li>` is now `flex h-full flex-col` with the
  button pinned by `mt-auto`. typecheck/lint green; Docker rebuilt and healthy.
- **2026-08-27** — Started the React Native mobile client
  (`planning/PLAN.md`). A three-agent verification pass confirmed the plan
  matches the codebase, then executed Phase 0 and Phase 1. Phase 0:
  `functionality.md` gained an in-scope row for the mobile client and
  out-of-scope rows for push notifications and offline mutation queueing;
  `project-overview.md`'s Aniyomi/Mihon alternative no longer implies a
  phone client is inherently out of scope for this project;
  `architecture.md` documents `mobile/` and its dependency rule (may import
  `src/lib/`, never `src/app/`/`src/server/`/`src/db/`). Phase 1: extended
  `GET`/`PATCH /api/settings` with `anilistLinked`/`malLinked`/
  `anilistSyncedAt`, backed by a new `linkedProviders()` helper in
  `server/settings-routes.ts`; added `GET /api/library/schedule` and
  extracted the query the `/schedule` page already ran into
  `lib/library/schedule.ts` (`getScheduleEntries`) so the route and the page
  share it — `schedule-list.tsx`'s `ScheduleItem` type now imports from
  there instead of defining its own; added `expo()` to `lib/auth.ts`'s
  plugins and `MOBILE_APP_SCHEME` (optional, `lib/env.ts`) to
  `trustedOrigins`; added `@better-auth/expo@1.6.25` (pinned to match the
  installed `better-auth@^1.6.25` peer requirement). New tests:
  `server/settings-routes.test.ts`, `lib/library/schedule.test.ts` — the
  latter surfaced a real gap in the shared db-stub mocking pattern (a fresh
  `stubDb()` per property access resets the query-answer counter, so a
  handler with more than one sequential query needs the stub instance held
  across the whole request, not recreated per access) that library-routes
  and mirror-routes tests never hit since their handlers only ever run one
  query. typecheck/lint/test all green (97/97). Deliberately not curled
  against a live dev server this session — `.env.local` here points at the
  operator's real deployment (real SMTP, real AniList/MAL apps, real DB),
  and starting `next dev` would arm the real poller.
- **2026-08-27 (continued)** — Phase 2: scaffolded `mobile/` via
  `npx create-expo-app@latest`, which turned out to be SDK 57 — newer than
  `planning/PLAN.md` assumed, with real structural differences (routes
  default to `src/app/` not `app/`; the default tab bar now uses
  `expo-router/unstable-native-tabs` instead of the stable `Tabs`). Deleted
  the demo scaffold (`NativeTabs`, `react-native-reanimated` splash
  animation, `@expo/ui`/`expo-glass-effect`/`expo-symbols`) rather than
  adapting it — see the decision log. Kept `src/app/` as the router root
  instead of forcing top-level `app/`, since it already matched the web
  app's own `@/*` → `./src/*` convention. Built: `metro.config.js`
  (`watchFolders` → `../src/lib`), `babel.config.js`
  (`babel-plugin-module-resolver` — needed in addition to tsconfig's
  `paths`, since Metro doesn't read tsconfig paths at bundle time),
  `mobile/src/theme.ts` (the web app's `globals.css` tokens, ported flat,
  dark-only), `mobile/src/api/client.ts` (the `ApiResult<T>` port, with a
  `setBaseUrl`/`setAuthHeadersProvider` seam left for Phase 3), a debug
  screen at `mobile/src/app/index.tsx` that calls `GET /api/health`, and
  `mobile/eslint.config.js` (own flat config — see the decision log for
  why it isn't shared with root). Root `eslint.config.mjs` and
  `tsconfig.json` both gained a `mobile` exclude/ignore — without it, root
  `typecheck`/`lint` broke by sweeping up `mobile/`'s files. Verified the
  riskiest part concretely rather than trusting the config: bundled
  `npx expo export` for both `web` and `android`, then grepped the output
  for a string that only exists inside the shared `filters.ts` to confirm
  the `@shared/*` import's real content — not just its type — made it into
  the bundle. Root `typecheck`/`lint`/`test` (97/97) still green
  afterward; `mobile/`'s own `tsc --noEmit` and `eslint .` both clean.
  Next: Phase 3 — server-url.tsx, the auth client (`@better-auth/expo`'s
  `expoClient`), and the login screen.
- **2026-08-27 (Phase 3)** — Server URL + auth. New in `mobile/src/auth/`:
  `server-url.ts` (validate via `GET /api/health` / persist to AsyncStorage
  / sync module-cache accessor), `client.ts` (`getAuthClient()` — builds the
  `@better-auth/expo` client lazily, rebuilds on URL change, wires the
  api-client cookie header), `context.tsx` (`<AuthProvider>` / `useAuth()` —
  owns the gate as `loading | no-server | no-session | ready`, plus
  `setServer`/`signIn`/`signOut`/`changeServer`). New screens:
  `app/server-url.tsx`, `app/login.tsx` (mirrors web `/login`, one AniList
  button); `app/index.tsx` went from the Phase 2 debug screen to the authed
  landing placeholder. `app/_layout.tsx` is now the gate — three
  mutually-exclusive `<Stack.Protected guard={…}>` branches (SDK 57's
  recommended pattern), replacing the per-page `getSession`+`redirect` the
  web repeats. Installed in `mobile/`: `better-auth`, `@better-auth/expo`,
  `expo-secure-store`, `@react-native-async-storage/async-storage`. Hit an
  npm version skew — `@better-auth/core@1.7.2` pulled in beside
  `better-auth@1.6.25`'s pinned `1.6.25`, breaking the client-plugin types;
  fixed with an `overrides` pin (decision log). `expoClient()` still needs a
  one-site cast to `BetterAuthClientPlugin` (packaged `getActions` arity
  mismatch). Verified: `mobile/` typecheck + `eslint .` clean; `expo export`
  bundles cleanly for android (1523 modules) and web (1056, all 3 routes
  render); root `typecheck`/`lint`/`test` (97/97) still green. NOT run on a
  device this session — needs an EAS dev build + a live server for the cold
  install → AniList consent → deep-link → force-quit-persistence check, and
  `MOBILE_APP_SCHEME=nekostream://` set on the server. Next: Phase 4 —
  Library / Schedule / Search tabs, and the `ui/` primitives.
- **2026-08-27 (Phase 4)** — The tab shell and the three read-mostly screens.
  `app/(tabs)/` now holds `_layout.tsx` (`Tabs` from `expo-router/js-tabs`,
  four destinations matching `SiteHeader`), `index.tsx` (Library),
  `schedule.tsx`, `search.tsx` and `settings.tsx`; the Phase 3 placeholder
  `app/index.tsx` was deleted rather than kept as a redirect, since it and
  `(tabs)/index.tsx` both resolve to `/`, and the gate's ready branch is now
  `<Stack.Screen name="(tabs)" />`. New `ui/`: `button`, `input`, `badge`,
  `anime-grid` (poster frame + grid metrics), `wordmark`, plus two the plan
  didn't list — `screen` (safe-area frame, title block, loading and empty
  states) and `option-sheet` (a `Modal` single-choice list, which is what the
  web's sort `<select>` becomes). New `components/`: `library-card`,
  `schedule-card` (the two-layer `EpisodeBar` and the `latestAired`
  derivation ported intact — that gap is the screen's whole point),
  `search-result-card`, `filter-chips`, `airing-badge`. New `hooks/`:
  `use-now` (the minute tick, without the web's null-until-mounted dance,
  which only existed to dodge a hydration mismatch), `use-sort-preference`
  (AsyncStorage under the same `nekostream:library-sort` key the web writes
  to `localStorage`), `use-anilist-sync`. `api/types.ts` grew the wire shapes
  and their Date-parsing mappers; `api/use-resource.ts` is the
  load-on-focus / pull-to-refresh pattern the three data tabs share. Filters,
  sorts and day grouping all come from `@shared/*` — verified concretely,
  not assumed, by grepping the exported Android bundle for strings that exist
  only inside `sort.ts` and `group.ts`. `theme.ts` gained the amber and
  danger tokens the schedule and error lines need, pre-blended because React
  Native has no `bg-amber-400/50`. One new dependency, `@expo/vector-icons`
  (font-based, no native module) for the tab glyphs; `context/tech-stack.md`
  gained a whole mobile matrix, which Phases 2–3 had left unwritten.
  Deviations are listed under Phase 4 in `planning/PLAN.md` — the ones that
  matter: a Settings tab shipped early so Phase 3's sign-out/change-server
  didn't become unreachable, library cards are not pressable until Phase 5's
  detail screen exists, and Search has no preview sheet for the same reason.
  Verified: `mobile/` typecheck + `eslint .` clean, `expo export` bundles for
  android and web; root `typecheck`/`lint`/`test` (97/97) green. Still not
  run on a device or against a live server — see the open items. Next:
  Phase 5 — detail screen, optimistic progress with per-tracker outcomes,
  magnet links, the Nyaa filter editor, and the real settings screen.
- **2026-08-27 (first device run)** — Got Phase 4 onto real hardware. EAS
  project had to be recreated: the ID supplied pointed at
  `@haruhadjs-team/haruhadj`, and Expo's slug is fixed at creation — the
  dashboard's "rename" only changes the display name, which the Expo GraphQL
  API confirmed (`name: nekostream`, `slug: haruhadj`). Created
  `@haruhadjs-team/nekostream` (`cfc255ef-…`) instead; `mobile/app.json` now
  carries that `projectId` and `owner`. Built the `preview` profile — a
  standalone APK, no Metro — with `EAS_NO_VCS=1`, because `mobile/` is still
  entirely untracked in git and the default VCS packing would have uploaded
  an empty tree. Keystore was generated cloud-side with no prompt.
  Installed to an Android 16 device over wireless adb and drove it with
  `adb shell input`. **Result: the client is fine, the server is not** — see
  the open items. Everything up to the auth wall works on hardware; the wall
  is `main` lacking Phase 1. Nothing in `mobile/` is committed yet.

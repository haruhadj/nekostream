# Progress Tracker

The most-updated file in this set. If this looks stale, everything else in
`context/` should be treated as suspect too.

## Current status (as of 2026-08-28)

Past the initial build. Day-to-day development still proceeds as a series of
small, complete features on `main` — but one genuinely large, multi-session
feature is in progress: a React Native (Expo) mobile client. Phases 0–4 of
`planning/PLAN.md` are done — scope/docs, the API gaps it needs, scaffolding
`mobile/`, server-URL entry + `@better-auth/expo` auth with the app-entry
gate, and the four-tab shell with Library, Schedule and Search reading real
data. A `preview` APK ran on a real Android 16 device.

**The premise then changed (2026-08-27).** `planning/STANDALONE.md`
supersedes `PLAN.md`'s Phase 5: the app becomes standalone — its own SQLite
database on the device, its own AniList/MAL OAuth, Nyaa discovery and the
poll tick running on-device — because the Pi's uptime isn't guaranteed and
every screen was dead when it was down. Done: Phase 0 (scope/docs), Phase
1a–1b (the device database) and Phase 2 (device-side AniList/MAL OAuth —
better-auth and the server URL are gone from the app entirely). 1c, the
one-time import of the Pi's data, only happens if the server is retired.
Phase 3 (AniList directly — the three data tabs read the device database, the
detail screen ticks progress to both trackers, `mobile/src/api/` deleted) and
Phase 4 (Nyaa on the device — shared `lib/nyaa/*`, the filter editor, the
episode list, magnet links) are done too. Only Phase 5 remains: background
updates and local notifications. **Phases 1–4 have now run on a real device**
(Android 16, Aug 27): sign-in, an 854-title import, Schedule, MAL linking and
database persistence across a force-quit all work; two device-only bugs were
found and fixed (Hermes' missing `Intl.RelativeTimeFormat`, and the OAuth
redirect landing on expo-router's "Unmatched Route"). What is still unverified
is everything that *writes* to a real account — a progress tick, a saved Nyaa
feed, a magnet hand-off — see the open items. Phases
0–4 of `PLAN.md` are not wasted: every screen, `ui/` primitive and
`components/` card survives — `api/*`, the `@better-auth/expo` stack and the
server-URL screen do not. Read `PLAN.md` for where Phases 2–4 deviated from
it (SDK 57 moved past what the plan assumed; Phase 3 used `Stack.Protected`
guards and needed an npm `overrides` pin; Phase 4 shipped a Settings tab
early and left library cards non-pressable).

**Whether the server and web app are retired is undecided** — the
recommendation in `STANDALONE.md` is to keep both until the standalone app's
background-update reliability is known, since retiring is irreversible in
practice and deferring costs one idle container.

**What has run on hardware, stated exactly.** On a real Android 16 device
(Aug 27–28): sign-in, the 854-title import, the Library and Schedule tabs,
MAL linking, the detail screen, live Nyaa discovery, and a saved feed pulling
real releases — plus database survival across both a force-quit and an app
update. **Not yet done by anyone:** a progress tick (it writes to the
operator’s real AniList and MAL lists) and a magnet tap (it hands a torrent to
their own client). Both were deliberately left to the operator rather than
driven from a session. Everything else has been verified by typecheck, lint,
`expo export`, bundle greps and SQL run against a real SQLite engine — useful,
but both device-only bugs this week were invisible to all of it.

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
| The mobile client goes standalone — own on-device database, direct AniList/MAL/Nyaa access — rather than moving the server to a paid host or splitting it | The Pi's uptime isn't guaranteed and every screen in the app was dead when it was down. Standalone removes the uptime problem instead of renting a solution to it. The one job a phone genuinely can't do is the Stremio addon, which the operator doesn't use. Accepted cost, stated plainly: new-episode detection goes from a one-minute server tick to best-effort background work with a ~15-minute floor throttled by Doze and the OEM battery manager, and email becomes a local notification. `planning/STANDALONE.md`. | Aug 27, 2026 |
| This converges on Aniyomi/Mihon, and `project-overview.md` now says so | The project defined itself against them as "a phone app, not something that runs unattended on a home server." For the phone client that distinction stops being true here. What stays genuinely distinct is the per-show saved-Nyaa-filter model and episode-level release tracking; the *server* still holds the original distinction while it runs. Recorded because a doc that quietly keeps claiming a dead distinction is worse than one that concedes it. | Aug 27, 2026 |
| MAL's public-client token exchange verified before Phase 0 landed, not assumed | It was the one load-bearing external claim in the standalone plan and it gated Phase 2. [MAL's docs](https://myanimelist.net/apiconfig/references/authorization): `client_secret` is "OPTIONAL in Scheme 1" (credentials in the request body) and "If your client doesn't have a client secret, `client_secret` will be an empty"; App Type `other` is issued none. So the app sends `client_id` + `code` + `code_verifier` in the body, no secret, no Basic header — refresh the same way. Constraints that follow: `code_challenge_method` is **`plain` only** (no S256), and the new MAL app must register as App Type `other`, not `web`. If it had needed a secret, MAL sync would have been the single feature still requiring a server. | Aug 27, 2026 |
| New OAuth app registrations for the mobile client, rather than reusing the server's | Both consoles take one redirect URI per client, and the existing ones point at the server, which must keep working if the web app survives. | Aug 27, 2026 |
| The device schema drops `userId` and the `user`/`session`/`account`/`stremio_token` tables | A device has exactly one user. Keeping `userId` would be ceremony enforcing an invariant that cannot be violated there. **This does not relax the rule on the server**, where every domain query stays scoped to the caller. | Aug 27, 2026 |
| Hermes' missing globals are shimmed in `mobile/src/polyfills.ts`, never worked around by forking the shared module | Twice now: `AbortSignal.timeout` (caught by reading React Native's source) and `Intl.RelativeTimeFormat` (caught by the app crashing on device). Both are called at module scope or on every request by code the server and the app share, and forking either would have split the domain layer permanently to paper over a runtime difference. The shim for `Intl.RelativeTimeFormat` was checked against Node's real ICU across 443 (value, unit) pairs — every range `@shared/format` can produce — rather than eyeballed. | Aug 27, 2026 |
| The OAuth redirect URIs get real expo-router routes (`app/auth/anilist.tsx`, `app/auth/mal.tsx`) that redirect to `/` | On device the redirect intent reaches expo-router as well as `openAuthSessionAsync`, and the router rendered "Unmatched Route — Page could not be found" over a sign-in that had *succeeded*. It made a working MAL link look broken, which is how it was reported. The routes exist purely to get out of the way and let the gate decide. | Aug 27, 2026 |
| `mobile/`'s Metro resolves shared modules' bare imports against `mobile/node_modules` (`resolver.nodeModulesPaths`) | A module under `src/lib/` resolves `fast-xml-parser` relative to *itself* — the repo root's `node_modules`, which Metro will not read. The alternative was watching the root's whole dependency tree. This way the app installs what the modules it shares need (`fast-xml-parser`, `zod`, version-matched by hand) and the two `package.json` files stay independent, which was the point of not using workspaces. Failures show up at bundle time, never at typecheck. | Aug 27, 2026 |
| `lib/nyaa/filter.ts`'s `SavedFilter` is spelled out instead of derived from `rssFilter.$inferSelect` | The device has its own `rss_filter` table and cannot import the server's `db/schema` at all. Both schemas satisfy the explicit type structurally, and a column that drifted would fail to typecheck wherever a row is passed as a `SavedFilter`. | Aug 27, 2026 |
| Two server modules re-pointed from `@/lib/*` to relative imports so they can be shared (`sync/mirror.ts`, `sync/tracker-entry.ts`) | `@/` means the web app's `src/` on the server and the mobile app's `src/` on the device, so any shared module importing through it resolves to the wrong place or to nothing. Three import lines changed, no behaviour changed, root tests green — and in exchange `writeAniListEntry`/`writeMalEntry` are shared outright instead of copied, so the GraphQL mutation and the MAL PATCH have one definition for both clients. | Aug 27, 2026 |
| The anime detail screen was built in Phase 3, earlier than the plan implies | Phase 3's deliverable is progress writes, and this app had nowhere to invoke them: library cards had been non-pressable since `PLAN.md`'s Phase 4 because the screen they would open was never built. A ported dual-write rule that nothing can call is not a ported rule. The screen carries progress, metadata and tracker links only — Phase 4's episode list and Nyaa filter have a stated placeholder rather than a stub. | Aug 27, 2026 |
| The airing refresh rides along with the library import | The Schedule tab renders `nextAiringAt`, which on the server the poller refreshes every six hours. There is no always-on process on the device until Phase 5, and the plan assigned this to no phase — so the import does it, with the same six-hour staleness and best-effort error handling, since failing to fetch broadcast times must not turn a successful library import into a reported failure. | Aug 27, 2026 |
| `expo-auth-session` dropped from Phase 2; the OAuth flows are `expo-web-browser` + `expo-crypto` directly | The plan named the library. Reading its source before building on it: `AuthRequest`'s constructor asserts `codeChallengeMethod !== CodeChallengeMethod.Plain` because plain "is not secure" — and `plain` is the *only* PKCE method MyAnimeList implements. It also adds nothing to AniList's implicit grant (no exchange, no PKCE). Keeping it would have meant working around an invariant for one tracker and not using it for the other. | Aug 27, 2026 |
| `AbortSignal.timeout` is polyfilled in the app rather than the shared clients being forked | React Native installs `abort-controller@3` as its AbortSignal, which predates the static — so `@shared/anilist/client`, `@shared/mal/client` and `@shared/nyaa/rss`, **every** external client the standalone app relies on, would have thrown on their first request, on device only. `mobile/src/polyfills.ts` patches the runtime instead, because sharing the domain layer unforked is the whole premise of the plan. Standing lesson: "imports nothing" does not mean "runs under Hermes". | Aug 27, 2026 |
| Tracker tokens go to SecureStore with one key per field, not one JSON blob per provider | SecureStore warns above 2048 bytes per value, and MAL's access + refresh pair could cross that together. Split, neither is close. The tokens deliberately do *not* go in the device SQLite database — that is app-private files; SecureStore is the keystore. | Aug 27, 2026 |
| A rejected MAL refresh clears the stored MAL credentials | MAL has said they are dead; keeping them only makes the next call fail identically, while the Settings screen goes on claiming a link that does not exist. Clearing makes the UI true, and re-linking is one tap. AniList has no equivalent path — it issues no refresh token, so expiry means signing in again. | Aug 27, 2026 |
| OAuth client ids live in `app.json`'s `extra`, empty by default | Same reasoning as the server URL before them: one operator, one build, nothing to ask at runtime. They are not secrets — AniList's implicit grant and MAL's public-client PKCE are designed to run on a client id alone. An unset id is reported on the login screen rather than opening a browser onto a provider error. | Aug 27, 2026 |
| Device row ids default to SQLite's own `lower(hex(randomblob(16)))`, not a UUID library or `crypto.randomUUID()` | Hermes' exact web-API surface is the kind of thing this project has already been bitten by assuming (see the `Intl` risk, still unverified). SQLite is guaranteed present — it *is* the database — and an explicitly-supplied id still wins, which is what keeps a straight copy of the server's better-auth-style text ids working if Phase 1c ever runs. | Aug 27, 2026 |
| `PRAGMA foreign_keys = ON` on the device connection | SQLite disables foreign keys **per connection**, so the schema's `onDelete: "cascade"` is inert without it — deleting a library entry would silently orphan its filter and episodes. On the server that cleanup is the database's job; it stays the database's job here. | Aug 27, 2026 |
| `library_entry` is unique on `anilistMediaId` alone (`library_entry_media_idx`), replacing the server's `(userId, anilistMediaId)` | With one user per device the media id carries the same meaning: a show appears in the library once. | Aug 27, 2026 |
| Migrations apply behind a gate that renders a visible error, not a silent catch | Every screen is about to read this database, and "empty library" is the wrong way to report "the schema never applied" — the same reasoning as the auth gate surfacing a revoked token rather than rendering nothing. `MigrationsGate` sits outside `AuthProvider` because the database has to exist before anything reads it. | Aug 27, 2026 |
| Phase 3 gate is three `<Stack.Protected>` guards, not an imperative `router.replace` in `_layout.tsx` | It's the SDK 57 docs' recommended auth pattern: expo-router redirects to whichever branch's `guard` is true when `useAuth().status` changes, so sign-in / sign-out / change-server flip screens with no navigation code. Session is tracked imperatively (getSession/signIn/signOut) rather than the client's `useSession` hook because `getAuthClient()` is rebuilt when the server URL changes. | Aug 27, 2026 |

## Open items

**Mobile client — carried into `planning/STANDALONE.md`:**
- ~~**BLOCKED ON THE OPERATOR: two OAuth apps.**~~ **Done Aug 27** — both
  registered, ids in `app.json` (`49090` / `005cbba7…`), MAL as App Type
  `other`, redirects `nekostream://auth/anilist` and `nekostream://auth/mal`.
  MAL's console accepted the custom scheme, which had been an open question.
- ~~**Untested: whether Android hands back AniList's URL fragment.**~~
  **It does** (Android 16, Aug 27). Sign-in completed and the library
  imported, so the implicit grant's `#access_token` survives
  `openAuthSessionAsync`. This was the one risk with no secret-free fallback;
  it is closed.
- **The Pi-deploy blocker below is now historical.** Phase 2 removed
  better-auth, `trustedOrigins` and `MOBILE_APP_SCHEME` from the client's
  path, so the "Invalid callbackURL" failure cannot recur. Deploying the Pi
  still matters if the web app is being kept (it runs a build without Phase
  1's API additions), but it no longer gates any mobile work. Left in full
  below because it is the only written record of what was observed on
  hardware.
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
  **Step 1 of 3 is done** — merged to `main` and pushed as `dceb555`
  (Aug 27). Still outstanding: redeploy the Pi from `main`, and add
  `MOBILE_APP_SCHEME=nekostream://` to its Compose env before restarting.
  Until both land, sign-in still fails and the Schedule tab 404s. The APK
  needs no rebuild for the deploy itself, only for the client changes that
  shipped alongside it.
- **The rest of the device pass is still unrun**, because sign-in gates it:
  AniList consent → deep link back → force-quit → session persists; then the
  Phase 4 side-by-side — same counts per filter tab, same sort order, same
  day grouping as the web app on the same account.
- Beware `adb exec-out screencap` on this device: it returned an all-black
  frame while the app was rendering normally. `uiautomator dump` showed the
  real view tree. Trust the hierarchy over the screenshot when they disagree.
- **`Intl` under Hermes — settled, and it is not one answer but three.**
  Verified on device Aug 27: **`Intl.Collator` works** (Library sorts
  correctly, `2.5 Dimensional Seduction` first under Title A–Z) and
  **`Intl.DateTimeFormat` works** (Schedule's day headers and air times).
  **`Intl.RelativeTimeFormat` does not exist** — it crashed the app on
  opening any anime, and is now shimmed in `mobile/src/polyfills.ts`. The
  lesson worth keeping: "Intl works" was never a single question, and passing
  two of three reads exactly like passing all three until the third is
  touched. Anything new reaching for `Intl.*` from shared code gets checked
  on device before it is relied on.
- `mobile/`'s eslint config still isn't type-aware, so `no-floating-promises`
  isn't enforced there. Phase 4 added plenty of async call sites, so the
  reason to revisit this is now real. Every `void`-prefixed promise in
  `mobile/src/` is deliberate; nothing enforces that it stays that way.
- **Phase 3's side-by-side is still half done.** The import ran on device: 854
  titles, filter counts (Watching 94, Planning 167, Completed 570, Paused 11,
  Dropped 12), sorted correctly. **Still owed: a progress tick** — that it
  lands on AniList *and* MAL, and that the per-tracker outcome line says so.
  Deliberately not driven from here: it writes to the operator's real lists.
- **`episodeCounts()` in `db/library.ts` has no caller.** It was added for
  Phase 4's episode list, which ended up reading rows directly. Delete it
  unless Phase 5 wants it — a query nothing calls is a query nobody checks.
- **Phase 4's verify is entirely device work:** save a filter against a show
  that is actually airing, confirm a real release appears, tap Magnet and
  confirm the OS hands it to a torrent client. None of it can be faked
  off-device, and a phone with no torrent client installed shows the alert
  rather than the hand-off.
- ~~**The device database has never run on a device.**~~ **Done Aug 27:**
  migrations applied at launch (no gate error), 854 rows written, and after a
  force-quit the library came back instantly with no re-import — the throttle
  skipped it and the rows came from SQLite. Survival across an app *update*
  is still unobserved; the next build over the top will show it.
- **The device becomes the only copy of Nyaa filters and discovered
  episodes** once the standalone client is the one in use. AniList still
  holds library and progress. Mitigation is an export/import in Settings, or
  keeping the server — tracked as the open decision above, not yet built.
- **Two clients' Nyaa filters diverge** if both keep running. Inherent to
  keeping both; documented, and deliberately not solved with sync.

**Verify-during-implementation (not blocking, but worth checking next time
this area is touched):**
- `MOBILE_APP_SCHEME` (and the `expo()` plugin in `lib/auth.ts`) exist only
  for a mobile client that authenticated through the server. Nothing uses
  them once the standalone app replaces the old APK. Deliberately left in
  place: removing server config belongs with the retire-or-keep decision, not
  with a mobile phase. Harmless while it sits there.
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
- **2026-08-27 (standalone pivot, Phase 0)** — Scoped `planning/STANDALONE.md`
  (`5de5d12`), which supersedes `PLAN.md`'s Phase 5: the app stops being a
  client against this server and becomes standalone. Driven by uptime, not
  by anything wrong with the client — the device run had just proved the
  client works and the server was the wall. Verified MAL's public-client
  token exchange against its live docs *before* touching anything, since it
  was the plan's one untested external claim and gated Phase 2: App Type
  `other` is issued no secret, and the token endpoint's body-credentials
  scheme makes `client_secret` optional, so `client_id` + `code` +
  `code_verifier` suffices; PKCE is `plain`-only there. Recorded in the plan
  and the decision log, and the corresponding risk row retired. Then executed
  Phase 0 (docs only, no code, matching how `PLAN.md`'s own Phase 0 ran):
  `functionality.md` gained an "in scope, in progress" section — kept
  separate from the shipped table on purpose — with rows for the standalone
  client, on-device storage, direct tracker auth/sync, on-device Nyaa
  discovery and local notifications; its push-notification row now excludes
  only the server-sent kind, and its offline-queueing row was rewritten since
  "writes against the live server" stopped being true.
  `project-overview.md` concedes the Aniyomi/Mihon comparison outright rather
  than keeping a distinction that no longer holds for this client.
  `architecture.md` documents `mobile/db/`, the widening of `@shared/*` from
  four modules to most of the domain layer, and the sharpened rule that goes
  with it (shareable = no `db`, no `env`, nothing from `app/`/`server/`).
  `PLAN.md` marks Phase 5 superseded at both its header and the section
  itself. **Undecided and left to the operator:** whether the server and web
  app are retired — recommendation is to keep both for a few weeks. Next:
  STANDALONE Phase 1 — the device database (`expo-sqlite` +
  `drizzle-orm/expo-sqlite`, schema minus `userId`, migrations generated
  into `mobile/drizzle/`).
- **2026-08-27 (STANDALONE Phase 1a–1b)** — The device database. New:
  `mobile/src/db/schema.ts` (`library_entry`, `rss_filter`, `episode` ported
  from `src/db/schema.ts` with identical column names, minus `userId` and the
  five auth/Stremio tables), `db/client.ts`, `db/migrations-gate.tsx`, and
  `mobile/drizzle.config.ts` (`driver: "expo"`) with the first migration
  generated into `mobile/drizzle/`. Wiring: `babel.config.js` gained
  `inline-import` for `.sql`, `metro.config.js` gained
  `sourceExts.push("sql")` — both halves are required, and with only one the
  import resolves to nothing and *no migrations apply silently*, which is why
  the bundle was checked rather than trusted. Installed `expo-sqlite`,
  `drizzle-orm@^0.45.2` (matching the server exactly), `drizzle-kit` and
  `babel-plugin-inline-import`; `expo install` added the `expo-sqlite` config
  plugin to `app.json`. Four decisions worth reading are in the log above —
  SQLite-generated ids, the foreign-keys pragma, the narrowed unique index,
  and the migration gate showing failures instead of an empty library.
  **Verified without hardware, deliberately, rather than deferring the whole
  check to a device:** grepped the exported Android `.hbc` for the migration
  SQL, the index names, the id default and the pragma (all present), then ran
  the generated DDL against a real SQLite engine via `node:sqlite` — ids
  generate, explicit ids still win, one row per show, episode dedupe on
  `(entry, nyaaId)`, orphans rejected, cascade clears children. `mobile/`
  typecheck + lint clean; root typecheck/lint/test (97/97) green. **Still
  unrun on a device** — persistence across force-quit and across an update is
  what a phone has to show. Next: STANDALONE Phase 2 — AniList implicit grant
  and MAL PKCE on-device, replacing `@better-auth/expo` and the server-URL
  screen.
- **2026-08-27 (STANDALONE Phase 2)** — Device-side auth. `better-auth`,
  `@better-auth/expo`, the `@better-auth/core` override, `auth/client.ts`,
  `auth/server-url.ts`, `app/server-url.tsx` and `extra.serverUrl` are all
  **gone**; the Android bundle drops 4.3 MB → 3.1 MB. New `src/auth/`:
  `config.ts` (client ids from `app.json`'s `extra`, redirect URIs),
  `url.ts` (encoding, deliberately expo-free so it can be executed
  off-device), `oauth.ts` (the browser round trip), `anilist.ts` (implicit
  grant + the Viewer query the server runs), `mal.ts` (PKCE plain, token
  exchange, refresh with an in-flight guard), `token-store.ts` (SecureStore
  per field + AsyncStorage for the non-secret profile). The gate is now
  `loading | no-tracker | ready` — MAL is optional and linkable from
  Settings, which was rebuilt around the two tracker accounts. Two findings
  worth carrying (both in the decision log): **`expo-auth-session` was
  installed and then removed** after reading its refusal of PKCE `plain`,
  which is all MAL supports; and **React Native has no
  `AbortSignal.timeout`**, which every shared external client calls — fixed
  with `src/polyfills.ts` rather than a fork, and a standing warning that
  "imports nothing" is not the same as "runs under Hermes". Verified: 9
  checks of the real `url.ts` executed under Node's type stripping (AniList's
  fragment, MAL's query, provider errors, `+`/percent decoding, a token with
  `-`/`_`, round trip, form body carries no `client_secret`); the exported
  Android bundle carries both authorize/token endpoints,
  `code_challenge_method` and the polyfill, and no longer contains
  better-auth. `mobile/` typecheck + lint clean; root typecheck/lint/test
  (97/97) green. **Blocked on the operator for two things:** registering the
  AniList and MAL apps (MAL as App Type `other`) and filling in
  `extra.anilistClientId` / `extra.malClientId`, and the device run — where
  the open question is whether Android delivers AniList's fragment intact.
  Next: STANDALONE Phase 3 — AniList directly, rewiring the three data tabs
  off `api/` onto the device database.
- **2026-08-27 (STANDALONE Phase 3)** — AniList directly, and **`mobile/src/api/`
  is deleted** — no caller left, wire types and `Date`-parsing mappers included
  (Drizzle returns real `Date`s, which is what the shared sort/grouping
  helpers want). New: `db/library.ts` (every screen read and write — the port
  of `library-routes.ts` plus `lib/library/schedule.ts`, minus the `userId`
  scoping a one-user device cannot need), `sync/import.ts` (the port of
  `lib/anilist/import.ts` with the server's five-minute throttle moved into
  AsyncStorage), `sync/progress.ts`, `data/use-query.ts` (the `useApiResource`
  contract, reading a `load()` instead of an HTTP path — the focus refetch
  behaviour was right for reasons unrelated to where data came from), and
  `app/anime/[id].tsx` + `components/progress-control.tsx`. Library cards are
  pressable at last. Three calls in the decision log: the **re-pointed
  `@/lib/*` imports** in two server modules, which is what lets the tracker
  writes be *shared* rather than copied; the **detail screen built here**,
  because Phase 3's deliverable is progress writes and nothing could invoke
  them; and the **airing refresh riding along with the import**, since the
  Schedule tab needs broadcast times the poller used to supply. Verified: 7
  checks of the import upsert against a real SQLite engine — local progress
  survives a stale sync (7, not 3), `lastActivityAt` never moves backwards,
  the saved Nyaa filter and row id survive, newer AniList activity does move
  forward, never-touched entries stay null rather than 1970, and repeated
  syncs make no duplicates; that check runs the ON CONFLICT clause by hand, so
  it proves SQLite's semantics rather than Drizzle's emission. The Android
  bundle now carries `MediaListCollection`, `SaveMediaListEntry`,
  `my_list_status` and `id_in`, and the only `/api/` left in it is AniList's
  own OAuth URL. `mobile/` typecheck + lint clean; root typecheck/lint/test
  (97/97) green after the shared-module change. **Still unrun on a device, and
  the side-by-side against AniList's web UI is still outstanding.** Next:
  STANDALONE Phase 4 — Nyaa on the device: share `lib/nyaa/*`, port
  `lib/library/refresh.ts`, filter editing, episode list, magnet links.
- **2026-08-27 (STANDALONE Phase 4)** — Nyaa on the device. `lib/nyaa/*` is
  shared whole — RSS fetch, title parsing, magnet construction, group/quality
  discovery — so all four have one definition across the server and the app.
  New: `db/nyaa.ts` (the filter/episode half of `library-routes.ts`),
  `sync/refresh.ts` (the port of `lib/library/refresh.ts`),
  `components/nyaa-filter-setup.tsx`, `components/nyaa-filter-panel.tsx`,
  `components/episode-list.tsx`; the detail screen's Phase 4 placeholder is
  now the real thing, with `Linking.openURL(magnetUri)` behind the Magnet
  button and an explicit alert when no app can handle it. One server change:
  `lib/nyaa/filter.ts`'s `SavedFilter` is spelled out rather than derived from
  `rssFilter.$inferSelect`, since the device cannot import `db/schema`. **Two
  bundler findings, both now in `architecture.md`:** a shared module resolves
  its bare imports relative to *itself*, so `fast-xml-parser` was looked for
  in the repo root's `node_modules` and the export failed — fixed with
  `resolver.nodeModulesPaths` plus `fast-xml-parser` and `zod` installed in
  `mobile/` too; and some shared modules import siblings as `./rss.ts`, which
  is load-bearing for the server's type-stripping test runner, so
  `mobile/tsconfig.json` sets `allowImportingTsExtensions` rather than the
  server dropping it. Verified: 7 more checks against a real SQLite engine —
  the feed upsert never duplicates, re-running the same feed adds nothing, a
  v2 re-encode *is* a new release, batches store with a null episode number,
  stop-tracking keeps the episodes it found, and deleting the anime cascades
  to them; the bundle carries `nyaa.si`, `nyaa:infoHash`, the magnet prefix,
  the tracker list and the quality ranks. `mobile/` typecheck + lint clean;
  root typecheck/lint/test (97/97) green. **Phase 4's own verify line is
  entirely device work and entirely outstanding** — a real feed, a real
  release, a real magnet hand-off. Next: STANDALONE Phase 5 — background
  updates and local notifications, the last phase.
- **2026-08-27 (the device run)** — Phases 1–4 met hardware, and it went
  mostly well and found two real bugs. The operator registered both OAuth apps
  (AniList `49090`, MAL `005cbba7…` as App Type `other` — its console did
  accept the `nekostream://` scheme); a `preview` APK went onto the Android 16
  device over wireless adb. **Working:** migrations at launch, AniList
  sign-in — **the implicit grant's URL fragment does survive
  `openAuthSessionAsync`**, which was the plan's one no-fallback risk — the
  import (854 titles, filter counts correct), Schedule's day grouping, MAL
  linking (Settings reads "Linked"), and the device database surviving a
  force-quit with no re-import. **Two bugs, both device-only:** (1) opening any
  anime crashed the app — `undefined cannot be used as a constructor`, because
  Hermes has no `Intl.RelativeTimeFormat` and `@shared/format` builds one at
  module scope, so the route module evaluated to `undefined` and expo-router
  then failed on `ErrorBoundary`; shimmed in `polyfills.ts`, checked against
  Node's ICU over 443 pairs. (2) the OAuth redirect also reaches expo-router,
  which rendered "Unmatched Route" over a *successful* MAL link — that is what
  "MAL linking doesn't work" turned out to be; both redirect paths now have
  routes that redirect to `/`. Worth recording plainly: the `Intl` risk had
  been reported here as settled after Collator and DateTimeFormat both
  passed — two of three reads exactly like three of three until something
  touches the third. Still unverified, and left to the operator because they
  write to real accounts: a progress tick reaching both trackers, a saved Nyaa
  feed, and a magnet hand-off.

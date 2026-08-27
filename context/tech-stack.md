# Tech Stack

Version matrix verified against `package.json` on 2026-08-27 (the server
matrix last re-read 2026-08-08; the mobile matrix added 2026-08-27). Re-check
before trusting these for an upgrade — this file goes stale the moment a
dependency bumps and nobody updates it here.

Two `package.json` files, two matrices: the server/web app at the repo root,
and the Expo client under `mobile/`. They share no dependency tree — see
`architecture.md`'s Dependency direction for what they *do* share.

## Server + web app (root `package.json`)

| Package | Version (pinned range) | Why this one |
|---|---|---|
| next | 16.2.12 | See `AGENTS.md`'s Next.js warning — this major has file-structure/API differences from older training data. Chosen for the App Router server-component model, which is what lets pages call `db` directly instead of round-tripping through the API. |
| react / react-dom | 19.2.4 | Pinned to match Next 16's peer requirement. |
| hono | ^4.12.32 | Runs the whole API as one mountable app inside a single Next.js route handler (`app/api/[...route]/route.ts`) via `hono/vercel`. Chosen over hand-rolled route handlers per file so middleware (`requireSession`, `handleUpstreamErrors`) and error mapping are written once (`server/shared.ts`), not per route. |
| better-auth | ^1.6.25 | OAuth session management. Its `genericOAuth` plugin is what lets AniList and MyAnimeList — neither a first-class better-auth provider — be wired up as config rather than hand-rolled OAuth flows. |
| drizzle-orm / drizzle-kit | ^0.45.2 / ^0.31.10 | SQL-shaped query builder + migrations that are readable `.sql` files under `drizzle/` — matters because the deployment target is a single operator inspecting their own SQLite file, not a team behind a migration tool with its own state. |
| @libsql/client | ^0.17.4 | SQLite driver. LibSQL over `better-sqlite3` because it's the driver Drizzle's SQLite dialect targets cleanly and it works the same in a plain `file:` mode as it would against a remote libSQL server, in case that's ever wanted later. |
| zod | ^4.4.3 | Every env var (`lib/env.ts`), request body, and route param is parsed through it. No manual `if` validation anywhere in route code — a new endpoint should follow that pattern, not deviate from it. |
| fast-xml-parser | ^5.10.1 | Parses the Nyaa RSS feed (`lib/nyaa/rss.ts`). |
| nodemailer | ^9.0.5 | SMTP client for the one notification email. Deliberately the only notification channel — see `functionality.md`. |
| tailwindcss / @tailwindcss/postcss | ^4 | Styling. v4's CSS-based config (no `tailwind.config.js`) — check `src/app/globals.css` for the actual token definitions rather than looking for a JS config file that doesn't exist in this version. |
| clsx / tailwind-merge | ^2.1.1 / ^3.6.0 | Combined into `lib/cn.ts`'s `cn()` helper — the standard shadcn-pattern class combinator, used by the `components/ui/*` primitives (`button.tsx`, `badge.tsx`, `input.tsx`, `switch.tsx`) so variant classes and caller overrides merge instead of colliding. No Radix/`class-variance-authority` — those primitives are hand-built, not generated, to keep the dependency surface small for a self-hosted single-operator app. |
| lucide-react | ^1.30.0 | Icon set, replacing the hand-rolled inline SVG paths that were scattered per-component (search icon, tab-bar glyphs, text-glyph "icons" like ✕/←/↗). |
| typescript | ^5 | `strict: true`, `moduleResolution: "bundler"`, `@/*` path alias to `src/*`. |

## Mobile client (`mobile/package.json`)

Read `mobile/AGENTS.md` first: SDK 57 moved past a lot of older training
data, and the versioned docs at `https://docs.expo.dev/versions/v57.0.0/`
are the authority over anything remembered.

| Package | Version (pinned range) | Why this one |
|---|---|---|
| expo | ~57.0.17 | The managed workflow, built locally since 2026-08-28 (see below). Never Expo Go — `expo-secure-store`, `expo-sqlite` and the custom `nekostream://` scheme all need a real native binary. |
| expo-router | ~57.0.17 | File-based routing whose tree maps 1:1 onto the web app's route table. Note two SDK 57 shifts: routes live in `src/app/`, and `Tabs` must be imported from `expo-router/js-tabs` — the re-export from `expo-router` itself is deprecated, and `expo-router/unstable-native-tabs` (what the template scaffolds) is not something to build on. |
| react-native / react | 0.86.3 / 19.2.3 | Whatever the SDK pins; do not float these independently of `expo`. |
| expo-secure-store | ~57.0.2 | The AniList and MAL tokens — this device's replacement for the server's `account` table. One key per field, since SecureStore warns above 2048 bytes per value and MAL's token pair could cross it. |
| expo-crypto | ~57.0.2 | Randomness for the PKCE `code_verifier` and the OAuth `state`. Not `Math.random()`: both values are security parameters. |
| @react-native-async-storage/async-storage | 2.2.0 | Non-secret per-device state: the library sort order, the tracker display names. Nothing a token depends on — that's SecureStore's job. |
| expo-image | ~57.0.3 | Cover art. `cachePolicy="disk"` matters: covers are immutable per media id, so scrolling the library twice shouldn't re-hit AniList's CDN. |
| expo-web-browser / expo-linking | ~57.0.2 / ~57.0.8 | The OAuth consent round trip and the deep link back into the app scheme. `openAuthSessionAsync` drives both trackers directly — see the note on `expo-auth-session` below. |
| @expo/vector-icons | ^15.0.2 | Tab bar glyphs. Font-based, so it adds no native module to the dev build. The `Feather` set is what `lucide-react` (the web's icons) was forked from, so the two clients' tab bars stay recognisably the same. |
| eslint-config-expo | ^57.0.2 | `mobile/` has its own flat config rather than joining the root's — different globals, different type-aware wiring. See the progress tracker's decision log. |
| expo-sqlite | ~57.0.2 | The device database. Opened with `enableChangeListener: true` so drizzle's `useLiveQuery` works — see `src/db/client.ts`. Adds a config plugin to `app.json`, so it needs a dev/preview build, not Expo Go. |
| drizzle-orm | ^0.45.2 | Same ORM and same version as the server, via its `drizzle-orm/expo-sqlite` driver — which is why the device schema is a port of `src/db/schema.ts` rather than a reinvention. Keep the two versions in step; they type the same shared rows. |
| drizzle-kit (dev) | ^0.31.10 | `driver: "expo"` emits `drizzle/migrations.js` alongside the `.sql`, so migrations ship inside the bundle and apply at launch. `npm run db:generate` in `mobile/`; never hand-edit `mobile/drizzle/`. |
| fast-xml-parser | ^5.11.1 | Not a new library decision — `@shared/nyaa/rss` already used it on the server, and a shared module resolves its bare imports against *this* app's `node_modules` (see `metro.config.js`'s `nodeModulesPaths` note). Keep it in step with root's copy. |
| zod | ^4.4.3 | Same reason: `@shared/nyaa/filter` carries the feed's schema. Also the project's validation library, per the root matrix. |
| babel-plugin-inline-import (dev) | ^3.0.0 | Inlines the migration `.sql` files at build time. Required by drizzle's Expo setup, together with `sourceExts.push("sql")` in `metro.config.js` — with only one of the two, the import silently resolves to nothing and no migrations apply. |

Deliberately **not** here: Tailwind or any styling runtime (plain
`StyleSheet` against `mobile/src/theme.ts`), any HTTP client (plain `fetch`,
per the rule below — the old `api/client.ts` went with Phase 3), and
**`react-native-svg`**. The two tracker marks that would have justified it
are SVG data URIs rendered by `expo-image`, which bundles native SVG decoders
on both platforms — see `src/ui/tracker-marks.ts`.

Also deliberately **not** here: **`expo-auth-session`**, which
`planning/STANDALONE.md` originally named for Phase 2. It was installed,
its source read, and removed — `AuthRequest`'s constructor asserts
`codeChallengeMethod !== CodeChallengeMethod.Plain` on the grounds that plain
"is not secure", and `plain` is the only PKCE method MyAnimeList implements.
It contributes nothing to AniList's implicit grant either (no token exchange,
no PKCE), so it would have been a dependency that neither flow used.
`expo-web-browser` + `expo-crypto` cover both, in `src/auth/oauth.ts`.

**Android builds run locally, not on EAS** (since 2026-08-28). `npm --prefix mobile run android` for a dev run; `mobile/scripts/local-release.sh` for a signed release APK. Requirements, none of them in `package.json`: the Android SDK (scoop `android-clt`, with build-tools 36 / platform 36 / platform-tools) and **JDK 17** — AGP rejects the JDK 25 that is on PATH, so the script pins `JAVA_HOME` at temurin17. `android/` is generated by `expo prebuild` and gitignored; treat it as disposable and never edit it by hand, which is why signing lives in the script rather than in `build.gradle`.

**When a shared module needs a package, `mobile/` installs it too.** There is
no hoisting between the two `package.json` files, and Metro will not read the
repo root's `node_modules` — so `fast-xml-parser` and `zod` are in both,
version-matched by hand. That is the cost of sharing without a workspace, and
it was the deliberate trade in the workspaces decision; when a shared module
gains a dependency, add it here and keep the versions in step.

**This matrix is what is installed today, and the standalone plan keeps
changing it.** Landed in Phase 1: `expo-sqlite`, `drizzle-orm`, `drizzle-kit`,
`babel-plugin-inline-import`. Landed in Phase 4: `fast-xml-parser`, `zod`.
Landed in Phase 2: `expo-crypto` — and
`better-auth` + `@better-auth/expo` are **gone**, along with the
`@better-auth/core` override that existed only to reconcile them (bundle:
4.3 MB → 3.1 MB). Still coming: `expo-background-task` and
`expo-notifications` (Phase 5). Update the matrix as each lands, not before.

## Runtime

- **Node 22+** required (README states this; dev environment observed at
  Node 24). Node is required, not optional — libSQL and the poller's
  `setInterval` don't run on Edge (see `architecture.md`).
- Tests run on Node's **built-in test runner**
  (`node --experimental-strip-types --experimental-test-module-mocks
  --import ./scripts/register-test-hooks.mjs --test "src/**/*.test.ts"`) —
  no Jest/Vitest. `--experimental-strip-types` means tests run directly
  against `.ts` sources, no separate test build step.

## Rules for adding a dependency

- Prefer a library that already has an established boundary in this
  codebase over introducing a second way to do the same thing — e.g. any
  new outbound HTTP call is a `fetch()` following the pattern in
  `lib/anilist/client.ts` / `lib/mal/client.ts`, not a new HTTP client
  library.
- Anything that needs to run in the browser bundle must not import `db` or
  anything that imports `db` — see the `lib/providers.ts` dependency-free
  note in `architecture.md`.
- Env vars for a new dependency go through `lib/env.ts`'s Zod schema, with
  the `z.preprocess((v) => v || undefined, ...)` pattern for anything
  optional — Compose passes empty string for unset vars, not undefined, and
  the schema needs to normalize that itself.

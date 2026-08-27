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
| expo | ~57.0.17 | The managed workflow. Distribution is an **EAS dev build**, not Expo Go — `expo-secure-store` and the custom `nekostream://` scheme both need a real native binary. |
| expo-router | ~57.0.17 | File-based routing whose tree maps 1:1 onto the web app's route table. Note two SDK 57 shifts: routes live in `src/app/`, and `Tabs` must be imported from `expo-router/js-tabs` — the re-export from `expo-router` itself is deprecated, and `expo-router/unstable-native-tabs` (what the template scaffolds) is not something to build on. |
| react-native / react | 0.86.3 / 19.2.3 | Whatever the SDK pins; do not float these independently of `expo`. |
| better-auth + @better-auth/expo | ^1.6.25 | One session model shared with the web app rather than a second bearer/JWT one. `@better-auth/core` is pinned to `1.6.25` through `overrides` — see the progress tracker's decision log for the version skew that forced it. |
| expo-secure-store | ~57.0.2 | Where `@better-auth/expo` keeps the session cookie. |
| @react-native-async-storage/async-storage | 2.2.0 | Non-secret per-device preferences: the operator's server URL, the library sort order. Not for anything the session depends on — that's SecureStore's job. |
| expo-image | ~57.0.3 | Cover art. `cachePolicy="disk"` matters: covers are immutable per media id, so scrolling the library twice shouldn't re-hit AniList's CDN. |
| expo-web-browser / expo-linking | ~57.0.2 / ~57.0.8 | The OAuth consent round trip and the deep link back into the app scheme. |
| @expo/vector-icons | ^15.0.2 | Tab bar glyphs. Font-based, so it adds no native module to the dev build. The `Feather` set is what `lucide-react` (the web's icons) was forked from, so the two clients' tab bars stay recognisably the same. |
| eslint-config-expo | ^57.0.2 | `mobile/` has its own flat config rather than joining the root's — different globals, different type-aware wiring. See the progress tracker's decision log. |
| expo-sqlite | ~57.0.2 | The device database. Opened with `enableChangeListener: true` so drizzle's `useLiveQuery` works — see `src/db/client.ts`. Adds a config plugin to `app.json`, so it needs a dev/preview build, not Expo Go. |
| drizzle-orm | ^0.45.2 | Same ORM and same version as the server, via its `drizzle-orm/expo-sqlite` driver — which is why the device schema is a port of `src/db/schema.ts` rather than a reinvention. Keep the two versions in step; they type the same shared rows. |
| drizzle-kit (dev) | ^0.31.10 | `driver: "expo"` emits `drizzle/migrations.js` alongside the `.sql`, so migrations ship inside the bundle and apply at launch. `npm run db:generate` in `mobile/`; never hand-edit `mobile/drizzle/`. |
| babel-plugin-inline-import (dev) | ^3.0.0 | Inlines the migration `.sql` files at build time. Required by drizzle's Expo setup, together with `sourceExts.push("sql")` in `metro.config.js` — with only one of the two, the import silently resolves to nothing and no migrations apply. |

Deliberately **not** here: Tailwind or any styling runtime (plain
`StyleSheet` against `mobile/src/theme.ts`), `react-native-svg`, and any
HTTP client — `mobile/src/api/client.ts` is a port of the web's
`lib/client/request.ts` over plain `fetch`, per the rule below.

**This matrix is what is installed today, and the standalone plan
(`planning/STANDALONE.md`) keeps changing it.** Landed in Phase 1:
`expo-sqlite`, `drizzle-orm`, `drizzle-kit`, `babel-plugin-inline-import`.
Still going: `better-auth` + `@better-auth/expo` (and with them the
`@better-auth/core` override), once the device does its own AniList/MAL
OAuth. Still coming: `expo-auth-session` (Phase 2), `expo-background-task`
and `expo-notifications` (Phase 5). `expo-secure-store` stays but changes
job — tracker access/refresh tokens instead of a better-auth session cookie.
Update the matrix as each lands, not before.

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

# Tech Stack

Version matrix verified against `package.json` on 2026-08-08 (updated same
day for the clsx/tailwind-merge/lucide-react addition). Re-check
before trusting these for an upgrade — this file goes stale the moment a
dependency bumps and nobody updates it here.

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

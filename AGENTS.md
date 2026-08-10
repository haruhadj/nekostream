<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

When writing, reviewing, or refactoring code, follow the `clean-code` skill.

# NekoStream — Agent Entry Point

Self-hosted anime tracker: AniList-synced library, per-show Nyaa episode
discovery, dual progress sync to AniList + MyAnimeList, a Stremio addon, and
a calendar/email layer for new episodes. Single-operator deployment (Docker,
Raspberry Pi 5) — see `context/project-overview.md` for the full picture.

## Read order

| # | File | What it gives you |
|---|---|---|
| 1 | `context/project-overview.md` | What this is, who it's for, non-goals |
| 2 | `context/functionality.md` | What's in scope, what isn't, and why — check before building anything |
| 3 | `context/architecture.md` | Folder layout, the request path, the poller, dependency rules |
| 4 | `context/user-flow.md` | Every route, the API surface, key flows |
| 5 | `context/tech-stack.md` | Libraries, why each was picked, rules for adding one |
| 6 | `context/code-standards.md` | Project-specific rules (env, error taxonomy, query scoping, sync pattern) |
| 7 | `context/progress-tracker.md` | Current state, decision log, open items, session log |

Read 1–3 before any non-trivial change. Read 6 before writing route or sync
code specifically.

## Rules that never change

**Scope**
- Nothing gets built that isn't listed in `context/functionality.md`. If a
  task isn't there, raise it before absorbing it into other work.

**Architecture**
- New API routes import `requireSession`, `handleUpstreamErrors`,
  `requireEntry`/`findEntry`, `parseBody`/`parseParam` from
  `server/shared.ts` rather than reimplementing them.
- Every query against a table carrying `userId` (directly or via a join to
  `library_entry`) must be scoped to the caller.
- `lib/` modules never import from `app/` or `server/`. `lib/providers.ts`
  stays dependency-free (no `db` import) — it's used from client
  components.
- There is exactly one poller per running server instance
  (`instrumentation.ts` → `lib/airing/poller.ts`); don't scale to multiple
  containers against the same database without adding coordination first.

**Process**
- Env vars go through `lib/env.ts`'s Zod schema — never read
  `process.env` directly elsewhere.
- New tracker-writing code follows `lib/sync/progress.ts`'s pattern: write
  locally first, then push to each enabled tracker independently and in
  parallel. One tracker failing must never block the other.
- Schema changes: `npm run db:generate` then `npm run db:migrate`. Never
  hand-edit a file under `drizzle/`.

**Libraries**
- No new HTTP client library — follow the `fetch()` pattern in
  `lib/anilist/client.ts` / `lib/mal/client.ts`.
- No manual `if`-validation on request bodies/params/env — Zod, matching
  the existing schemas.

## Session workflow

**Start of session:** read files 1–3 above at minimum, plus
`context/progress-tracker.md`'s open items and session log.

**End of session, if anything changed:**
- Update `context/progress-tracker.md` — append a session-log line, update
  the decision log if a non-obvious call was made, move resolved items out
  of "open items."
- If scope changed, update `context/functionality.md` in the same commit.
- If a new library or a version bump happened, update
  `context/tech-stack.md`'s matrix and its verified date.

## The invariants

- Every domain row is scoped to a `userId`. An id from another account
  404s, never leaks existence.
- The poller notifies by email only when *it* finds the specific episode it
  was waiting for — never on a manual refresh (that would re-notify a
  show's entire back catalog the first time a feed is saved).
- `BETTER_AUTH_URL` is the single canonical origin; sessions are cookies
  that don't cross origins. See `README.md`'s Configuration section for the
  operational detail — that stays there, not duplicated here.
- One tracker (AniList or MAL) failing during a sync never blocks or
  discards the other tracker's write or the local write that already
  happened.

## Commands

```bash
npm run dev            # dev server
npm run build           # production build
npm test                # unit tests (Node's built-in runner)
npm run typecheck       # tsc --noEmit
npm run lint             # ESLint (no-explicit-any, no-floating-promises are errors)
npm run db:generate      # after changing db/schema.ts
npm run db:migrate       # apply pending migrations
```

# Code Standards

Project-specific rules only. For general TypeScript/React quality, defer to
the `clean-code` skill — this file exists for the rules that are specific to
*this* codebase and would otherwise only live in someone's head.

## Env vars: never read `process.env` directly

All configuration goes through `lib/env.ts`'s `env` proxy, which validates
lazily (on first property access, not at import) via a Zod schema. This is
deliberate, not incidental: a Docker build has no secrets present, and eager
validation at import time would fail the build itself. Reading
`process.env.X` directly anywhere else bypasses both the validation and the
`v || undefined` normalization that optional vars need (Compose sends empty
string for an unset var, not a missing key).

## Error taxonomy: throw typed errors, map them in one place

`TokenError`, `AniListError`, `MalError`, `NyaaFetchError` are the only
errors a route handler should let escape uncaught — `server/shared.ts`'s
`handleUpstreamErrors` maps each to its HTTP status. **Do not add a
try/catch in a route handler to map an error to a status code** — that's
exactly the duplication `server/shared.ts` was written to remove (see its
file header). If a new upstream integration needs a new error type, add it
to that taxonomy and register it in `handleUpstreamErrors`, not as a local
catch block.

## Every query against a domain table is scoped to the caller

`library_entry`, `rss_filter`, `episode`, `stremio_token` all carry or
descend from `userId`. Use `findEntry`/`requireEntry` from
`server/shared.ts` for anything keyed on a `libraryEntry` id — never
`db.select().from(libraryEntry).where(eq(libraryEntry.id, id))` alone. An id
from another account must 404, not 403 or leak existence.

## The dual-write pattern for tracker sync

`lib/sync/progress.ts` is the reference implementation: write locally first,
then push to each enabled tracker **independently and in parallel**
(`Promise.all` over per-tracker jobs), where one tracker failing never
blocks the other or discards the already-saved local write. Any new
tracker-writing code should follow this shape — sequential writes or a
shared failure path would mean a MAL outage blocking an AniList update that
has nothing to do with it.

## Comments: reserved for the non-obvious constraint

The existing codebase's comment style is the bar to match: comments explain
*why*, especially platform quirks and workarounds (e.g. `lib/tokens.ts`'s
note on AniList issuing no refresh token, `lib/auth.ts`'s note on MAL's
`plain`-only PKCE). They do not restate what the code does. Don't add a
comment that a reader loses nothing by deleting.

## Linting

- `@typescript-eslint/no-explicit-any`, `no-floating-promises`,
  `no-unused-vars` (with `_`-prefix ignore pattern) are `error`, not `warn`
  — a PR that introduces one doesn't pass CI-equivalent checks locally
  (`npm run lint`).
- Test files (`*.test.ts`, `lib/test-support/**`) relax a handful of these
  rules (see `eslint.config.mjs`) because `node:test`'s `test()` manages its
  own promise, and the fakes intentionally stand in for wider platform
  types. Don't carry those relaxations into non-test code.
- Prettier is the formatter of record (`.prettierrc`: double quotes off —
  i.e. double quotes, `printWidth: 80`, ES5 trailing commas). Run
  `npm run format` rather than hand-formatting to match it.

## Money / time representation

No money in this codebase (no payments — see `functionality.md`). Times are
always `integer` Drizzle timestamp columns (`{ mode: "timestamp" }`, stored
as Unix ms) mapped to JS `Date`, never a string column — see `db/schema.ts`
for the pattern on every `*At` column.

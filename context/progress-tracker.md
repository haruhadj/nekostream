# Progress Tracker

The most-updated file in this set. If this looks stale, everything else in
`context/` should be treated as suspect too.

## Current status (as of 2026-08-08)

Past the initial build. There is no formal phase plan in play — development
proceeds as a series of small, complete features on `main`, each merged and
deployed on its own (see commit log). This file tracks that ongoing state
rather than a phase table; add a `planning/PLAN.md` + `PHASE-N.md` set only
if a genuinely large, multi-session feature gets scoped (e.g. a real
multi-week calendar, which would need a schema change — see
`functionality.md`).

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

## Open items

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

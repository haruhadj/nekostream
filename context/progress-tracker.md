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

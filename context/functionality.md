# Functionality

The scope-creep brake. If it isn't listed as in-scope below, raise it before
building it — don't absorb it because you're already in the file.

## In scope, and shipped

| Area | What it does | Where |
|---|---|---|
| Auth | Sign in with AniList (gates the app) or link MyAnimeList later from Settings. Both as generic OAuth2 via better-auth. | `lib/auth.ts` |
| Library | Bulk-imported from the user's AniList lists, cached locally (title, cover, progress, status). Filterable tabs incl. an "Untracked" tab for entries added by hand. | `app/page.tsx`, `lib/library/*`, `components/library-grid.tsx` |
| Episode discovery | One saved Nyaa RSS search per library entry (query/category/filter). Refreshing re-runs the search; releases already seen are never re-added (keyed on Nyaa torrent id). | `lib/nyaa/*`, `lib/library/refresh.ts` |
| Automatic polling | Background poller arms a feed only inside the window after AniList says an episode aired, and disarms the moment that episode shows up. No polling between broadcasts. | `lib/airing/poller.ts`, `lib/airing/schedule.ts` |
| Stop tracking | Delete the saved `rss_filter` row for one entry, taking it out of the poller and clearing its episode list state without removing the library entry itself. | `server/library-routes.ts`, `components/nyaa-filter-panel.tsx` |
| Progress sync | Ticking progress writes locally first, then pushes to AniList and MyAnimeList independently and in parallel — one tracker failing never blocks the other or the local write. Per-anime toggles for which trackers participate. | `lib/sync/progress.ts` |
| Mirror / reconcile | Compares the AniList and MAL lists directly and lets the user resolve titles that are only on one side or disagree on status/progress. Distinct from the per-tick dual-write: this is a manual one-off reconciliation, not something that runs automatically. | `server/mirror-routes.ts`, `components/mirror-review.tsx` |
| Schedule | `/schedule` lists each library entry's next episode, grouped by day, from the AniList broadcast schedule the poller already syncs every 6 hours. One upcoming episode per show — not a multi-week schedule, because that's all the data model stores (`nextAiringAt`/`nextAiringEpisode` on `library_entry`, singular). | `app/schedule/page.tsx`, `lib/schedule/group.ts` |
| Email notifications | One email per newly-found episode, sent only by the poller when it finds the specific episode it was waiting for — never on a manual refresh, which would otherwise re-notify a show's entire back catalog the moment its feed is first saved. Requires `notificationEmail` + the Settings toggle + SMTP env vars all set; any one missing makes it a silent no-op. | `lib/email/*`, `lib/airing/poller.ts` (`pollDueFeeds`) |
| Stremio addon | `/api/stremio/<token>/manifest.json` exposes the library as catalogs (one per tab) and each episode's releases as streams. Token-in-URL auth because Stremio can't send cookies. Paginated 100 at a time via `skip`, but sorting/filtering happens over the *whole* list in memory before slicing — first-page latency improves, total server work doesn't. | `server/stremio-routes.ts` |
| Mobile client | A React Native (Expo) client against the existing API — same library, schedule, search, progress sync, episode discovery, and settings screens as the web app. No server-side behavior of its own; the server remains the one source of truth for the library, the poller, and tracker sync. | `mobile/` |

## Out of scope, and why

| Not building | Why |
|---|---|
| Downloading/seeding torrents | NekoStream is a discovery and tracking layer, not a torrent client. Magnet links are the product; what opens them is the user's own client or Stremio. |
| General Nyaa search/browse UI | Each library entry gets exactly one saved search. A general Nyaa browser is a different, larger product (that's what Nyaa's own site is for). |
| Multi-week calendar / season schedule | The schema stores one `nextAiringAt`/`nextAiringEpisode` pair per entry, refreshed on a rolling basis — there is no history of past or future airings to render a real calendar grid from. Building the UI for it would require a schema change first. |
| Admin console / invite system | Single-operator deployment model (see `project-overview.md`). Every account is provisioned by the operator handing out OAuth access, not by a signup flow. |
| Scheduled polling as a *separate configurable feature* | It exists (`lib/airing/poller.ts`, started from `instrumentation.ts`), but it is not user-configurable — no on/off toggle, no interval setting. It runs whenever the app runs. **Note:** `README.md`'s "How it works" section still says "v1 refreshes on demand only; scheduled polling is deliberately not implemented yet" — that line is stale as of the calendar/notifications work (commits `386cf1b`, `a2f122f`) and should be corrected next time README is touched. |
| Push/SMS notifications | Email is the one notification channel (see the row above) — the mobile client does not add push as a second channel. Adding another means another set of credentials to configure for a single-operator deployment where email already covers the need. |
| Offline mutation queueing (mobile) | The mobile client reads and writes against the live server the same way the web app does. Queueing writes made while offline for later replay is a distinct feature with its own conflict-handling story, not something the client gets for free. |
| Non-SQLite database | The whole deployment story (single Docker volume, `docker compose down -v` to reset, Raspberry Pi target) assumes one file. Swapping engines is a real migration, not a config change. |

## Rules

- Nothing gets built that isn't in the table above without updating this
  file first — that's what keeps it trustworthy.
- "While I'm in here" is scope creep. A bug fix in `poller.ts` doesn't grow
  into a configurable polling interval.
- If a change touches the stale README line above, fix the README line in
  the same commit rather than leaving the drift for later.

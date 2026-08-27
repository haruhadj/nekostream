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

## In scope, in progress — the standalone mobile client

Scoped in `planning/STANDALONE.md`, which supersedes `planning/PLAN.md`'s
Phase 5. These rows are **not shipped** and are kept out of the table above
until they are. The premise changed on 2026-08-27: the React Native (Expo)
client was built as a second client against this server's API (Phases 0–4),
and is being re-hosted as a client that talks to AniList, MyAnimeList and
Nyaa **directly** and stores everything on the device. The reason is uptime —
the Pi's availability isn't guaranteed, and every screen was dead when it
was down.

| Area | What it does | Where |
|---|---|---|
| Mobile client | A React Native (Expo) app with the same library, schedule, search, progress sync, episode discovery and settings screens as the web app — but no dependence on this server. Screens, `ui/` primitives and `components/` from Phase 4 survive; the data layer underneath them is replaced. | `mobile/` |
| On-device storage | `expo-sqlite` + `drizzle-orm/expo-sqlite` holds the library, Nyaa filters and discovered episodes locally. The device schema is `db/schema.ts` minus `userId` and minus the auth tables — a device has exactly one user. The device becomes the only copy of filters and episodes; AniList still holds library and progress. | `mobile/src/db/` |
| Direct tracker auth + sync | The app authenticates to AniList (implicit grant) and MyAnimeList (PKCE, public client, no secret) itself and reads/writes both directly. The dual-write rule is unchanged and ported, not rewritten: write locally first, then push to each tracker independently and in parallel — one tracker failing never blocks the other or the local write. | `mobile/src/auth/`, `@shared/sync/progress` |
| On-device Nyaa discovery | The saved-search-per-entry model, the poll state machine and the refresh logic run on the device against Nyaa directly, sharing `lib/nyaa/*` and `lib/airing/schedule.ts` through `@shared/*`. Nyaa's politeness limits carry over — a per-tick fetch cap and a gap between requests. | `@shared/nyaa/*`, `mobile/src/` |
| Local notifications (mobile) | `expo-background-task` runs the same tick the server's poller runs; `expo-notifications` raises a local notification when the awaited episode is found. **Keeps the poller's invariant** — notify only when *this* tick found the specific episode it was waiting for, never on a manual refresh. Best-effort by nature: a phone gets a ~15-minute floor throttled by Doze and the OEM battery manager, not the server's one-minute tick. | `mobile/src/` |

Email stays the server's channel and is not available to the standalone
client — it needs SMTP, which needs a server. Whether the server and web app
are retired is an open decision (see `planning/STANDALONE.md`); the
recommendation is to keep both until background-update reliability is known.

## Out of scope, and why

| Not building | Why |
|---|---|
| Downloading/seeding torrents | NekoStream is a discovery and tracking layer, not a torrent client. Magnet links are the product; what opens them is the user's own client or Stremio. |
| General Nyaa search/browse UI | Each library entry gets exactly one saved search. A general Nyaa browser is a different, larger product (that's what Nyaa's own site is for). |
| Multi-week calendar / season schedule | The schema stores one `nextAiringAt`/`nextAiringEpisode` pair per entry, refreshed on a rolling basis — there is no history of past or future airings to render a real calendar grid from. Building the UI for it would require a schema change first. |
| Admin console / invite system | Single-operator deployment model (see `project-overview.md`). Every account is provisioned by the operator handing out OAuth access, not by a signup flow. |
| Scheduled polling as a *separate configurable feature* | It exists (`lib/airing/poller.ts`, started from `instrumentation.ts`), but it is not user-configurable — no on/off toggle, no interval setting. It runs whenever the app runs. **Note:** `README.md`'s "How it works" section still says "v1 refreshes on demand only; scheduled polling is deliberately not implemented yet" — that line is stale as of the calendar/notifications work (commits `386cf1b`, `a2f122f`) and should be corrected next time README is touched. |
| Push notifications (server-sent) | Still out. **Local** notifications raised by the mobile client's own background task are now in scope (see the row above) — that reverses `planning/PLAN.md`'s out-of-scope line ("push notifications — email remains the one channel"), but only for the on-device kind. A server pushing to a device needs a push service and another set of credentials, and the standalone client is precisely the thing that no longer talks to the server. SMS remains out for the same credentials reason. |
| Offline mutation queueing (mobile) | The standalone client writes locally first and then pushes to each tracker, so a tracker write attempted offline fails and is surfaced — it is not queued for replay. A durable retry queue is a distinct feature with its own conflict-handling story, not something the local-first write gets for free. |
| Non-SQLite database | The whole deployment story (single Docker volume, `docker compose down -v` to reset, Raspberry Pi target) assumes one file. Swapping engines is a real migration, not a config change. |

## Rules

- Nothing gets built that isn't in one of the tables above without updating
  this file first — that's what keeps it trustworthy.
- A row moves from "in progress" to the shipped table when it actually runs,
  not when the code compiles. `mobile/` has typechecked and bundled for
  weeks; that is not the same as shipped.
- "While I'm in here" is scope creep. A bug fix in `poller.ts` doesn't grow
  into a configurable polling interval.
- If a change touches the stale README line above, fix the README line in
  the same commit rather than leaving the drift for later.

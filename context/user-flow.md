# User Flow

## Routes

| Route | Renders | Auth | Notes |
|---|---|---|---|
| `/` | Library — filterable grid of tracked anime | required, redirects to `/login` | Home. Filter tabs incl. "Untracked". First visit for a new user triggers the AniList bulk import (`AniListSync firstRun`). |
| `/login` | Sign-in | — | AniList OAuth only; MAL is not offered here (see below). |
| `/search` | AniList search/browse | required | Add a title to the library. |
| `/anime/[id]` | One library entry's detail | required, entry scoped to caller | Nyaa filter setup/edit, episode list, progress control, "stop tracking" (delete `rss_filter`). |
| `/calendar` | Next-episode-per-show, grouped by day | required | See `functionality.md` for what it does and doesn't show. |
| `/settings` | Notification email + toggle, MAL link/unlink, Stremio token | required | |
| `/settings/mirror` | AniList/MAL list reconciliation | required | Manual, one-off — not something the poller runs. |

Navigation is `SiteHeader` (`components/site-header.tsx`): a top bar on
`sm:` and wider, a bottom tab bar (Library/Calendar/Search/Settings) on
phones — only one is ever visible at once, not a responsive collapse of the
other. Any new top-level page needs an entry in both.

## API surface (mounted under `/api` by the Hono app)

| Path | Guarded by `requireSession`? | Purpose |
|---|---|---|
| `/api/health` | no | Liveness check. |
| `/api/auth/*` | — | Owned entirely by better-auth. |
| `/api/library/*` | yes | CRUD on library entries + their `rss_filter`, refresh-episodes. |
| `/api/anilist/*` | yes | AniList-specific actions (bulk import, tracker editor writes). |
| `/api/mirror/*` | yes | The reconciliation plan/apply flow behind `/settings/mirror`. |
| `/api/settings/*` | yes | Notification email/toggle, Stremio token rotate. |
| `/api/stremio/<token>/*` | **no** — token-in-path instead | Deliberately outside the session guard; Stremio can't send cookies. See `architecture.md`. |

## Key flows

### First sign-in
`/login` → AniList OAuth → redirected to `/` → `AniListSync` runs the bulk
import (only on first visit, gated by `user.anilistSyncedAt` being null) →
library populates.

### Tracking a new show
`/search` → pick a title → added to library (untracked) → `/anime/[id]` →
set up a Nyaa search (`nyaa-filter-setup.tsx`) → `rss_filter` row created →
poller arms polling once AniList reports a broadcast time.

### Stopping tracking
`/anime/[id]` → delete the saved Nyaa filter (`nyaa-filter-panel.tsx`) →
`rss_filter` row removed → entry drops out of the poller and calendar's
"has a feed" logic, but stays in the library as an ordinary (now untracked)
entry.

### New episode → notification
Poller finds the target episode in the Nyaa feed (`pollDueFeeds`) → episode
rows inserted → if `notifyNewEpisodesByEmail` and `notificationEmail` are
both set, one email goes out for that episode. This never happens on a
manual "refresh episodes" click — only the poller's own find triggers it
(see `functionality.md`).

## Rules that ride along

- Every authenticated page repeats its own `getSession` + redirect check —
  there's no shared layout-level guard (see `architecture.md`). A new
  authenticated page must include this, not assume a parent layout covers
  it.
- Library filter/sort state lives in the URL (`?status=`) and a stored
  client preference, not server session — so a page reload and a shared
  link both reproduce the same view.

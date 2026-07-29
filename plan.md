Here is your updated project plan with the new RSS fetch intervals, and the clean structure maintained across all sections.
## 📌 Project Overview
**Goal:** Build a self-hosted, Dockerized anime tracking app that automates finding episodes via Nyaa.si (RSS/Search) and seamlessly syncs watch progress with AniList and MyAnimeList (MAL).
## 🔑 Authentication & Integrations
 * **AniList OAuth (Primary):**
   * Require AniList login before adding any anime to the local library.
   * Fetch and populate initial user library data directly from AniList.
 * **MyAnimeList (MAL) OAuth:**
   * Configure MAL OAuth settings in the app settings panel.
   * Once linked, sync watch progress simultaneously to both AniList and MAL (dual-write, same pattern as Mihon/Tachiyomi/Aniyomi trackers).
 * **Visual Indicators:**
   * Display a subtle icon/indicator on the anime page if it exists in the user's MAL database.
 * [ ] Insert additional auth / API settings here
## 🎬 Anime Catalog & Discovery
 * **Search & Browse:**
   * Use the AniList API to drive search, discovery, and detailed metadata pages.
 * **Library Management:**
   * Add/remove anime to personal library (tied to AniList account).
 * [ ] Insert additional catalog features here
## 📺 Anime Detail Page & Nyaa.si Integration
 * **Nyaa.si Search & Mapping:**
   * Show Nyaa.si search interface immediately when adding an anime to the library for the first time.
   * Use Nyaa.si search parameters/filters to save and auto-generate the canonical episode list for that title.
     * The saved filter query doubles as the RSS source, e.g. `https://nyaa.si/?page=rss&q=mushoku+tensei+s3+1080p+subsplease&c=1_2&f=0` — episode list is derived directly from parsing this RSS feed's item titles, no separate mapping step.
   * Provide direct manual search access via Nyaa.si search tools inside the anime page.
 * **Episode List & RSS:**
   * Display dynamic episode lists driven by saved Nyaa.si RSS parameters.
   * **Magnet Button:** Implement direct magnet: links, preserving default browser behavior to trigger local external torrent apps.
   * **RSS Fetch Mode:** Manual refresh only for v1 (user-triggered fetch, no default polling interval). Automated/scheduled polling is a later addition once manual flow is proven.
 * for faster first time setup of the rss anime episodes, detect the popular release groups and the quality options first but make the 1080p as default 
## 🔄 Progress Sync & Notifications
 * **Automated / Dynamic Progress Updates:**
   * Toggle progress sync per-anime (Sync AniList / Sync MAL).
   * Global settings page to manage sync behavior across connected accounts.
 * **Email Notifications (deferred, not v1 priority):**
   * Send email alerts whenever new RSS feed matches/episodes drop.
   * Revisit after core library/RSS/sync flows are working.
 * [ ] Insert additional sync / notification logic here
## 🐳 Deployment & DevOps
 * **Dockerization:**
   * Containerize the app stack for easy self-hosting and production deployment (optimized for ARM64 / Raspberry Pi 5).
   * Manage environment variables (OAuth credentials, SMTP details for email, RSS poll intervals).
 * [ ] Insert additional deployment/CI-CD steps here
 * [ ] 
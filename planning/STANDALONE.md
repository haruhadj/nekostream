# Standalone Mobile Client — Implementation Plan

Status: accepted; Phases 0, 1a–1b, 2 and 3 done (2026-08-27), 1c conditional
on the open decision below. Nothing has run on a device yet, and Phase 2 needs
two OAuth app registrations from the operator before it can — see Phase 2's
note. Scoped 2026-08-27, superseding Phase 5 of
`planning/PLAN.md`. MAL's public-client token exchange was verified before
Phase 0 landed — see finding 2.

## Context

`planning/PLAN.md` built the mobile client as a second client against the
NekoStream server. Phases 0–4 shipped on that basis and a `preview` APK ran
on a real device. This plan changes the premise: the app talks to AniList,
MyAnimeList and Nyaa **directly**, stores everything on the device, and does
not need the server at all.

The reason is uptime. The server runs on a Raspberry Pi 5 whose availability
isn't guaranteed, and today every screen in the app is dead when the Pi is.
Three alternatives were weighed — moving the server to a host (Fly/Railway/
VPS), splitting it (phone reads AniList/Nyaa directly, server keeps the
poller and Stremio), and going standalone. The operator does not use the
Stremio addon, which was the only remaining job a phone genuinely cannot do,
so standalone wins: it removes the uptime problem rather than renting a
solution to it.

### Say the quiet part first

`context/project-overview.md` lists "Aniyomi/Mihon (mobile app)" under
alternatives, with the reasoning "it's a phone app, not something that runs
unattended on a home server." **This plan converges on that alternative.**
After it, NekoStream's phone client is architecturally a Mihon-shaped app
with AniList/MAL sync and a Nyaa source.

That is not an argument against it — the operator has weighed it and chosen
it — but the plan should not pretend otherwise, and `project-overview.md`
has to stop claiming a distinction that no longer holds for this client.
What remains genuinely different is the Nyaa-filter-per-show model and the
episode-level release tracking, which is the part worth keeping.

### What is actually lost

| Lost | Severity |
|---|---|
| Guaranteed-timely new-episode detection | Real. A server checks every minute; a phone gets best-effort background work with a ~15-minute floor, throttled by Doze and by this device's OEM battery manager. |
| Email notification | Replaced by a local notification. Email needs SMTP, which needs a server. |
| The Stremio addon | Gone for this client. Only matters if the server is also retired — see the open decision below. |
| Server-side backup of filters/episodes | The device becomes the only copy of Nyaa filters and discovered releases. AniList still holds library and progress. |

---

## The shape of the problem

Four findings from reading the codebase drive the phases below.

**1. Most of `lib/` is already portable.** Verified by import graph, not
assumed:

| Module | Imports | Portable |
|---|---|---|
| `lib/anilist/client.ts` | *none* | yes |
| `lib/mal/client.ts` | *none* | yes |
| `lib/airing/schedule.ts` | *none* | yes — the whole poll state machine |
| `lib/sync/status.ts` | *none* | yes |
| `lib/nyaa/rss.ts`, `parse-title.ts`, `discover.ts` | `fast-xml-parser`, each other | yes |
| `lib/anilist/queries.ts` | its own client | yes |
| `lib/sync/mirror.ts` | `lib/providers` (already shared) | yes |
| `lib/nyaa/filter.ts` | `zod`, a *type* from `db/schema` | yes, once the type is re-pointed |
| `lib/sync/progress.ts` | `lib/tokens` (db-bound) | after the token read is injected |
| `lib/library/refresh.ts` | `db` | logic yes, wiring no |
| `lib/tokens.ts`, `lib/anilist/import.ts` | `db`, `env` | no — device equivalents needed |

The `@shared/*` alias from Phase 2 already works. This plan widens it from
four modules to most of the domain layer. That is the single biggest reason
this is tractable: the app is not being rewritten, it is being re-hosted.

**2. Neither tracker needs a client secret from a native app.** AniList
supports the implicit grant (`response_type=token`), which returns the token
in the redirect fragment with no exchange. MyAnimeList supports PKCE with a
`client_id` alone. The server's fixed `MAL_CODE_VERIFIER` exists only
because better-auth's `genericOAuth` needed a static value; a native app
generates a fresh verifier per request, which is PKCE used correctly.

**✅ Verified against MAL's live docs (2026-08-27), so Phase 2 is unblocked.**
[MAL's authorization reference](https://myanimelist.net/apiconfig/references/authorization)
describes two client-authentication schemes for `POST /v1/oauth2/token` —
credentials in the request body (Scheme 1) or HTTP Basic (Scheme 2) — and
makes `client_secret` "OPTIONAL in Scheme 1; REQUIRED in Scheme 2", adding:
"If your client doesn't have a client secret, `client_secret` will be an
empty." A client registered with **App Type `other`** is issued no secret.
So the mobile app uses Scheme 1: `client_id` + `code` + `code_verifier` +
`grant_type` in the body, no `Authorization` header, no secret. Refresh
authenticates the same way. Two constraints that follow, both already in the
plan: `code_challenge_method` is **`plain` only** — MAL supports no S256 —
and the new MAL app must be registered as App Type `other`, not `web`
(the server's existing app keeps its secret and is untouched).

**3. Drizzle runs on the device.** `drizzle-orm/expo-sqlite` ships in the
installed `drizzle-orm`. The device can use the same ORM and the same
migration tooling as the server, so `db/schema.ts` is a starting point
rather than a thing to reinvent.

**4. Phase 4's screens survive; their data source does not.** The Library,
Schedule and Search screens, every `ui/` primitive and every `components/`
card stay. What changes is underneath: `api/client.ts`, `api/use-resource.ts`
and `api/types.ts` are replaced by local queries and direct AniList calls.
Expect the screens to be re-wired, not rewritten.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| AniList auth | Implicit grant, token in SecureStore | No secret, no exchange. Tokens are long-lived (1 year) and AniList issues no refresh token, so there is nothing to rotate. |
| MAL auth | PKCE, `client_id` only, fresh verifier per request | The correct public-client flow. MAL *does* issue refresh tokens (~31 days), so refresh has to be handled on-device — unlike AniList. |
| OAuth registration | **New** provider apps for the mobile client | Both consoles take one redirect URI per client, and the existing ones point at the server. The server's apps must keep working if the web app survives. |
| Device storage | `expo-sqlite` + `drizzle-orm/expo-sqlite` | Same ORM, same migration tooling, and the relational shape the app already has. AsyncStorage stays for scalars (sort order, last-sync time). |
| Device schema | `db/schema.ts` minus `userId`, minus `user`/`session`/`account`/`stremio_token` | A device has exactly one user. Keeping `userId` would be ceremony enforcing an invariant that cannot be violated. |
| Background work | `expo-background-task` + `expo-notifications` | The only mechanism available. Best-effort by nature — see Risks. |
| Code sharing | Widen `@shared/*` to the verified-pure modules above | Already proven in Phase 2; this is more of the same, not a new mechanism. |

### Open decision — the server and the web app

**This plan does not decide whether the server is retired.** Three coherent
outcomes, and the operator picks:

- **Keep both.** The web app stays on the Pi for desktop use; the phone is
  independent. Both mirror AniList, so library and progress stay consistent.
  Nyaa filters diverge — each client has its own. Stremio keeps working.
  Nothing in this repo is deleted.
- **Keep the server, drop the web UI.** Pointless — the server exists to
  serve it.
- **Retire the server.** The repo becomes the Expo app. Deletes `src/`,
  `drizzle/`, the Dockerfile and Compose file, and needs the Pi's SQLite
  data migrated onto the phone first (Phase 1c).

Recommended: **keep both** until the standalone app has run for a few weeks
and the background-update reliability is known. Retiring the server is
irreversible in practice; deferring it costs one idle container.

---

## Phase 0 — Scope and docs

No code. Land this first so the rest is in-scope by the project's own rules,
exactly as `planning/PLAN.md`'s Phase 0 did.

- `context/functionality.md` — the mobile-client row currently reads "a
  client against the existing API with no server-side behaviour of its own."
  That inverts. Add rows for on-device storage, direct tracker sync and
  on-device Nyaa discovery. **Move push/local notifications from out-of-scope
  to in-scope** — Phase 0 of the previous plan put them out, and this
  reverses that. Note that email remains the server's channel and is not
  available to the standalone client.
- `context/project-overview.md` — correct the Aniyomi/Mihon comparison per
  "Say the quiet part first" above.
- `context/architecture.md` — `mobile/` no longer merely "may import from
  `src/lib/`"; it owns its own database and talks to third parties directly.
  The dependency rule still holds (never `src/app/`, `src/server/`, `src/db/`)
  and matters more, not less.
- `planning/PLAN.md` — mark Phase 5 superseded by this document.

**Verify:** the four files agree with each other and with this plan.

---

## Phase 1 — The device database

The foundation everything else sits on.

- **1a.** `mobile/src/db/schema.ts` — port `libraryEntry`, `rssFilter` and
  `episode` with `userId` and the `user`/`session`/`account`/`stremio_token`
  tables dropped. Keep column names identical so the migration in 1c is a
  straight copy and so `@shared/*` types still line up.
- **1b.** Drizzle wiring: `drizzle-orm/expo-sqlite`, `useMigrations`, and a
  `drizzle.config.ts` in `mobile/` emitting to `mobile/drizzle/`. Per
  `AGENTS.md`, migrations are generated, never hand-edited — that rule now
  applies in two places.
- **1c.** *(only if the server is retired)* A one-time import of the Pi's
  SQLite data. Simplest path: an authenticated export endpoint on the server
  returning the three tables as JSON, consumed once by the app. Cheaper than
  file transfer, and it can be deleted afterwards.

**Verify:** `expo run:android` with a seeded database; rows survive a
force-quit and a reinstall-preserving update.

**Done 1a–1b (2026-08-27).** Verified as far as it goes without hardware:
the Android bundle really contains the migration SQL, the id default and the
foreign-key pragma (grepped, not assumed), and the generated DDL was executed
against a real SQLite engine (`node:sqlite`) to confirm generated ids,
explicit ids still winning, one-row-per-show, episode dedupe on
`(entry, nyaaId)`, orphan rejection and cascade delete. **The on-device half
of this Verify line is still outstanding** — nothing has run on a phone, so
persistence across a force-quit and across an update is asserted by the
platform, not observed.

---

## Phase 2 — Device-side auth

Replaces `@better-auth/expo`, `auth/context.tsx`'s server gate, the
server-URL screen and the baked `extra.serverUrl`. All of that goes.

- **2a.** AniList implicit grant via `expo-auth-session` /
  `WebBrowser.openAuthSessionAsync`, redirect `nekostream://auth/anilist`,
  token to SecureStore.

> **Done 2026-08-27, and `expo-auth-session` is not part of it.** The library
> was installed, its source read, and removed: `AuthRequest`'s constructor
> asserts `codeChallengeMethod !== CodeChallengeMethod.Plain` ("not secure"),
> and `plain` is the only method MAL implements. Since it also contributes
> nothing to an implicit grant — no exchange, no PKCE — it would have been a
> dependency neither flow used. `expo-web-browser` + `expo-crypto` instead.
- **2b.** MAL PKCE (`plain`, per MAL's own limitation), fresh verifier per
  attempt, refresh-token handling with expiry tracked on device. Token
  requests use body-credentials auth with `client_id` and no secret, per the
  verification above. Register the mobile app as App Type `other`.
- **2c.** Rework the gate: `loading | no-tracker | ready`. MAL becomes
  optional and linkable later, as on the web.

**Verify:** on device — sign in, force-quit, session persists; revoke the app
on AniList's side and confirm the failure is legible rather than a silent
empty library.

**Done 2026-08-27, unverified on hardware and blocked on registration.** The
code is in and the bundle carries both flows; what is missing is two things
only the operator can do:

1. **Register the two OAuth apps** and put their ids in `app.json`'s
   `extra.anilistClientId` / `extra.malClientId` (both are empty strings
   today, and the login screen says so rather than opening a broken browser).
   Redirect URIs, exactly: `nekostream://auth/anilist` and
   `nekostream://auth/mal`. **MAL's app must be App Type `other`** — `web`
   issues a secret and the public-client flow stops working.
2. **The device run.** One thing here genuinely cannot be checked off-device:
   AniList's implicit grant returns the token in the URL *fragment*, and
   whether Android delivers a fragment intact through
   `openAuthSessionAsync` is a platform behaviour, not a code path. If it
   arrives empty, AniList offers no fallback that avoids a client secret —
   that would be the point to reconsider.

Also worth knowing: **a new dependency, `expo-crypto`,** for the PKCE verifier
and `state`, and one carried-over risk retired — see the `AbortSignal`
polyfill note under Risks.

---

## Phase 3 — AniList directly

Rewires Phase 4's screens off the API.

- Port `lib/anilist/import.ts`'s query logic against the device database.
- Library, Schedule and Search read locally, refreshing from AniList.
- Progress writes follow `lib/sync/progress.ts`'s existing rule, which
  survives intact and is the point of porting rather than rewriting it:
  **write locally first, then push to each tracker independently and in
  parallel — one tracker failing never blocks the other or discards the
  local write.**

**Verify:** side-by-side against AniList's own web UI — same list contents,
same progress after a tick, MAL updated too.

**Done 2026-08-27, and it grew one screen.** Progress writes need somewhere to
be invoked from, and this app had no detail screen — library cards had been
non-pressable since Phase 4 of `PLAN.md` precisely because the screen they
would open was never built. A ported dual-write rule that nothing can call is
not a ported rule, so `app/anime/[id].tsx` landed here: poster, metadata from
AniList, the progress stepper, tracker links, and a stated placeholder where
Phase 4's episode list and Nyaa filter go.

Two other things worth knowing:

- **`api/` is deleted.** No caller was left. The wire types and their
  `Date`-parsing mappers went with it — Drizzle already returns real `Date`s,
  which is exactly what the shared sort and grouping helpers want.
- **Two server modules had their `@/lib/*` imports re-pointed to relative
  ones** (`sync/mirror.ts`, `sync/tracker-entry.ts`). `@/` means the *web
  app's* `src/` on the server and the *mobile app's* `src/` on the device, so
  an alias import is unshareable by construction. With that one change,
  `writeAniListEntry` and `writeMalEntry` are shared outright rather than
  copied — the GraphQL mutation and the MAL PATCH have one definition
  between both clients. Root tests stayed green (97/97).

The schedule needed one thing the plan did not assign to a phase: broadcast
times. On the server the poller refreshes those every six hours, and there is
no always-on process here until Phase 5, so the refresh rides along with the
library import (same six-hour staleness, best-effort — a failure there must
not turn a successful import into a reported failure).

---

## Phase 4 — Nyaa on the device

The feature that justifies the app.

- Share `lib/nyaa/*` through `@shared/*`.
- Port `lib/library/refresh.ts`'s logic against the device database.
- Filter discovery and editing, episode list, `Linking.openURL(magnetUri)`.

**Verify:** save a filter, find a real release, open a magnet, confirm the OS
hands it to a torrent client.

---

## Phase 5 — Background updates and notifications

Where the honest limitations live.

- `expo-background-task` running the same tick `lib/airing/poller.ts` runs,
  driven by the already-pure `lib/airing/schedule.ts` state machine.
- `expo-notifications` for a local notification when the awaited episode is
  found. **Keep the poller's invariant:** notify only when *this* tick found
  the specific episode it was waiting for — never on a manual refresh, or
  the first sync of a feed re-notifies a whole back catalogue.
- Nyaa politeness carries over: `MAX_FETCHES_PER_TICK` and the 3-second gap
  exist so ten shows airing at once don't become ten simultaneous requests.

**Verify:** on the real device, over several days, with the OEM battery
optimiser both on and off. Measure the lag between air time and notification
rather than asserting it works.

---

## Risks, most likely first

| Risk | Mitigation |
|---|---|
| ~~MAL needs a client secret after all~~ | **Retired 2026-08-27** — verified against MAL's docs: App Type `other` gets no secret, and the token endpoint's body-credentials scheme makes `client_secret` optional. Residual risk is only that registration is misconfigured as `web`. |
| Background updates are unreliable on this device | Known and accepted. Measure it in Phase 5; a manual pull-to-refresh always works. Do not promise timeliness the platform can't give. |
| The device becomes the only copy of filters/episodes | An export/import in Settings, or keep the server (see the open decision). |
| Two clients' Nyaa filters diverge | Inherent to keeping both. Document it; don't build sync for it. |
| `Intl` under Hermes still unverified | Carried over from `planning/PLAN.md` and now overdue — Library and Schedule both depend on it. **The same class of bug already bit once and was caught in Phase 2:** React Native has no `AbortSignal.timeout`, which *all three* shared clients (`anilist/client`, `mal/client`, `nyaa/rss`) call. Fixed with a shim in `mobile/src/polyfills.ts` rather than a fork, because the point is to share the domain layer. Treat "it imports nothing" as necessary but not sufficient for portability — the runtime has to be checked too. |
| AniList's implicit grant returns the token in a URL *fragment* | Whether Android hands the fragment back through `openAuthSessionAsync` is a platform behaviour, not a code path — it can only be checked on hardware. If it arrives empty there is no secret-free fallback (AniList's code grant needs a client secret and it supports no PKCE), so this would force a rethink. First thing to watch on the device run. |
| Sunk work in `mobile/src/api/` | Real but small: the screens, `ui/` and `components/` all survive. |

## Explicitly out of scope

Server-side anything. Multi-device sync of Nyaa filters. iOS (nothing here
prevents it, but it is untested and unbudgeted). Any change to the server's
poller or tracker sync while it continues to run.

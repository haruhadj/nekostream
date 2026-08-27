# Project Overview

## What this is

NekoStream is a self-hosted anime tracker for one operator running it for
themselves (and optionally a small circle of accounts they trust — there is
no invite/admin system, just whoever the operator gives OAuth access to).
It replaces checking AniList, MyAnimeList, and a Nyaa.si search by hand with
one page: a library synced from AniList, an episode list scraped from a
saved Nyaa RSS search per show, and progress writes that go to both trackers
at once.

## The problem it solves

Someone tracking a season of anime today juggles three tabs: AniList or MAL
for the list itself, Nyaa for finding releases, and their own memory for
which episode a group has actually released versus which one just aired.
NekoStream collapses that into: add a show once, get an episode list that
updates itself, tick progress once and have it land on both trackers, and
optionally get an email the moment a tracked release actually appears.

## Who it's for

A single technical operator, self-hosting on their own hardware (built and
verified on a Raspberry Pi 5, arm64). Not a hosted SaaS, not sold, not
multi-tenant in the sense of unrelated organizations — every account is
someone the operator personally gave OAuth credentials to. This shapes the
whole project: no billing, no admin console, no onboarding flow beyond
"sign in with AniList," and configuration lives in environment variables
because the audience can set those.

## What success means

- Adding a show and a Nyaa search is enough — no manual re-checking of Nyaa.
- Progress ticked in NekoStream shows up on AniList and MAL without a
  separate visit to either site.
- The Stremio addon lets the library double as a Stremio catalog/stream
  source without re-entering anything.
- Running unattended: the background poller and (optional) email
  notifications work without the operator watching logs.

## Deliberate non-goals

- **Not a torrent client.** NekoStream surfaces magnet links; it never
  downloads or seeds anything itself.
- **Not a general media server.** No transcoding, no library outside what's
  tracked on AniList/MAL, no video playback of its own beyond what Stremio
  provides via the addon.
- **Not multi-tenant SaaS.** No plans, billing, or per-tenant isolation
  beyond the per-user rows every table already has via `userId`.
- **Not a Nyaa alternative.** One saved search per show, not a general
  search/browse UI for Nyaa itself (see `functionality.md`).

## Alternatives and why they don't fit

- **Doing it by hand (AniList + MAL + Nyaa tabs)** — works, but the whole
  point of this project is removing that manual loop.
- **Aniyomi/Mihon (mobile app)** — closest philosophical match (the
  dual-tracker-write model in `lib/sync/progress.ts` is deliberately the
  same pattern) but it's a full standalone app with its own source/tracking
  logic, not a thin client to a server that runs unattended and emails you —
  which is why NekoStream's own mobile client (`mobile/`) is a client
  against this project's existing API instead of a separate app to adopt.
- **Sonarr + a tracker's own apps** — Sonarr assumes you want automated
  downloading, which is explicitly out of scope here; NekoStream stays at
  "here's the magnet link."

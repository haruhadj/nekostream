# NekoStream

Self-hosted anime tracking. Browse and search via AniList, build episode lists
from a saved Nyaa.si RSS search, and sync watch progress to AniList and
MyAnimeList at the same time.

## Requirements

- Docker and Docker Compose (deployment), or Node 22+ (development)
- OAuth apps registered with AniList and MyAnimeList

## Configuration

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -hex 32      # MAL_CODE_VERIFIER
```

Register the OAuth apps and set their redirect URLs to match `BETTER_AUTH_URL`:

| Provider | Console | Redirect URL |
| --- | --- | --- |
| AniList | <https://anilist.co/settings/developer> | `$BETTER_AUTH_URL/api/auth/oauth2/callback/anilist` |
| MyAnimeList | <https://myanimelist.net/apiconfig> | `$BETTER_AUTH_URL/api/auth/oauth2/callback/mal` |

### Origins

| Variable | Required | What it is |
| --- | --- | --- |
| `BETTER_AUTH_URL` | yes | The single canonical origin. Forms every OAuth redirect URI. |
| `PUBLIC_URL` | no | The public https origin, when it differs. Only the Stremio addon URL uses it. |

`BETTER_AUTH_URL` must be the address you actually reach the app on, and there
can only be one of it. Sessions are cookies, and a cookie set on one origin is
never sent to another — so reaching the app on both a LAN address and a
hostname means signing in on whichever one `BETTER_AUTH_URL` names. Behind TLS
it must be the `https://` form, or the `Secure` session cookie is never set.

Both provider consoles must be updated whenever it changes. AniList validates
the redirect URI as part of client authentication, so a stale registration
fails as `invalid_client` / "Client authentication failed" — which reads like a
bad client secret but is not. To tell the two apart, POST to the token endpoint
with a junk code: `invalid_client` means the redirect URI does not match, while
`Cannot decrypt the authorization code` means the credentials are fine.

`PUBLIC_URL` exists because the Stremio addon has a different constraint.
Stremio Web refuses to load an addon over plain http, while OAuth is usually
pointed at a LAN address on a home setup. Set `PUBLIC_URL` and the addon URL
shown in Settings uses it regardless of which origin the browser is on; leave
it unset and the addon URL follows the incoming request. When the app is
reached on one https hostname throughout, it is redundant — set it to the same
value or omit it.

## Deploy

```bash
docker compose up -d
```

Built and verified on arm64 (Raspberry Pi 5). The container runs as a non-root
user, applies database migrations on every boot, and refuses to start if
configuration is incomplete.

The SQLite database lives in the `nekostream-data` volume at
`/data/nekostream.db` — that volume is the thing to back up.

```bash
docker compose logs -f          # follow logs
docker compose down             # stop, keeping data
docker compose down -v          # stop and delete the database
```

## Development

```bash
npm install
npm run db:migrate   # create the local SQLite schema
npm run dev
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | Generate a migration after changing the schema |
| `npm run db:migrate` | Apply pending migrations |

## How it works

- **Auth** — better-auth with AniList and MyAnimeList as generic OAuth2
  providers. AniList sign-in gates the app; MyAnimeList is linked later from
  Settings. MAL only supports the `plain` PKCE method, so its verifier comes
  from `MAL_CODE_VERIFIER` rather than better-auth's built-in S256 flow.
- **Episodes** — each library entry stores a Nyaa search (terms, category,
  filter). Refreshing re-runs that search as RSS and stores any releases not
  seen before, so refreshing repeatedly is safe. v1 refreshes on demand only;
  scheduled polling is deliberately not implemented yet.
- **Stremio** — an addon at `/api/stremio/<token>/manifest.json` exposes the
  library as catalogs (one per library tab, sorted via Stremio's `genre`
  dropdown) and serves each episode's scraped releases as streams. Stremio
  cannot send session cookies, so the URL carries a per-user secret instead;
  copy or rotate it from Settings. Catalogs page 100 at a time via the `skip`
  extra, which cuts first paint on a large library but does not reduce server
  work — the untracked filter and the sorts run in memory, so every page still
  loads and orders the whole list before slicing. Sorting spans the full set
  deliberately, so page 3 is the 201st–300th in that order rather than a
  re-sorted chunk.
- **Progress** — writes land in the local database first, then push to the
  enabled trackers independently. One tracker failing never blocks the other or
  discards the local write.

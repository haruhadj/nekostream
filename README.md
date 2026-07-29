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

`BETTER_AUTH_URL` must be the address you actually reach the app on — it forms
the OAuth redirect URI, so a mismatch fails the sign-in round trip.

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
- **Progress** — writes land in the local database first, then push to the
  enabled trackers independently. One tracker failing never blocks the other or
  discards the local write.

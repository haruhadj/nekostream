import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./nekostream.db"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),

  ANILIST_CLIENT_ID: z.string().min(1),
  ANILIST_CLIENT_SECRET: z.string().min(1),

  MAL_CLIENT_ID: z.string().min(1),
  MAL_CLIENT_SECRET: z.string().min(1),
  // MyAnimeList only supports the "plain" PKCE method, and better-auth's built-in
  // PKCE is hardcoded to S256 — so the verifier is supplied via env instead.
  // Must be 43-128 unreserved characters.
  MAL_CODE_VERIFIER: z.string().min(43).max(128),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

function loadEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/**
 * Validated lazily on first property access rather than at import. A Docker
 * build has no secrets present, and eager validation would fail the build
 * before the container ever receives its real environment.
 */
export const env = new Proxy({} as Env, {
  get: (_target, key: string) => loadEnv()[key as keyof Env],
  has: (_target, key: string) => key in loadEnv(),
  ownKeys: () => Reflect.ownKeys(loadEnv()),
  getOwnPropertyDescriptor: (_target, key) =>
    Reflect.getOwnPropertyDescriptor(loadEnv(), key),
});

/**
 * The two trackers, named once.
 *
 * Dependency-free on purpose: this is imported by client components as well as
 * by the token and sync layers, and must not drag the database in with it.
 */

export type Provider = "anilist" | "mal";

export const PROVIDERS: Provider[] = ["anilist", "mal"];

/** How each tracker is named to the user. */
export const PROVIDER_LABEL: Record<Provider, string> = {
  anilist: "AniList",
  mal: "MyAnimeList",
};

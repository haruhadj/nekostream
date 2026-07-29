import { anilistRequest } from "./client";

export type AniListMedia = {
  id: number;
  idMal: number | null;
  title: { romaji: string; english: string | null };
  coverImage: { large: string | null } | null;
  bannerImage: string | null;
  episodes: number | null;
  format: string | null;
  status: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  genres: string[];
  description: string | null;
};

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english }
  coverImage { large }
  bannerImage
  episodes
  format
  status
  seasonYear
  averageScore
  genres
  description(asHtml: false)
`;

export async function searchMedia(
  search: string,
  { page = 1, perPage = 24 } = {}
) {
  const data = await anilistRequest<{
    Page: {
      pageInfo: { total: number; currentPage: number; hasNextPage: boolean };
      media: AniListMedia[];
    };
  }>(
    `query ($search: String, $page: Int, $perPage: Int) {
       Page(page: $page, perPage: $perPage) {
         pageInfo { total currentPage hasNextPage }
         media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
       }
     }`,
    { search, page, perPage }
  );

  return data.Page;
}

/** Trending is what the browse screen shows before the user types anything. */
export async function trendingMedia({ page = 1, perPage = 24 } = {}) {
  const data = await anilistRequest<{
    Page: {
      pageInfo: { total: number; currentPage: number; hasNextPage: boolean };
      media: AniListMedia[];
    };
  }>(
    `query ($page: Int, $perPage: Int) {
       Page(page: $page, perPage: $perPage) {
         pageInfo { total currentPage hasNextPage }
         media(type: ANIME, sort: TRENDING_DESC) { ${MEDIA_FIELDS} }
       }
     }`,
    { page, perPage }
  );

  return data.Page;
}

export async function mediaById(id: number) {
  const data = await anilistRequest<{ Media: AniListMedia | null }>(
    `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`,
    { id }
  );

  return data.Media;
}

/**
 * Only the fields the local library actually stores. A full account can carry
 * several hundred entries, so descriptions, banners and genres are left out —
 * the detail page fetches those per-anime on demand.
 */
type ImportMedia = Pick<
  AniListMedia,
  "id" | "idMal" | "title" | "coverImage" | "episodes"
>;

export type ViewerListEntry = {
  progress: number;
  status: string | null;
  /** Unix seconds; when the user last changed this entry on AniList. */
  updatedAt: number | null;
  /** Unix seconds; when the entry was added to the AniList list. */
  createdAt: number | null;
  media: ImportMedia;
};

/** Used to seed the local library from the user's existing AniList lists. */
export async function viewerLibrary(accessToken: string) {
  const viewer = await anilistRequest<{ Viewer: { id: number } | null }>(
    `query { Viewer { id } }`,
    {},
    { accessToken }
  );

  if (!viewer.Viewer) return [];

  const data = await anilistRequest<{
    MediaListCollection: {
      lists: Array<{ entries: ViewerListEntry[] }>;
    };
  }>(
    `query ($userId: Int) {
       MediaListCollection(userId: $userId, type: ANIME) {
         lists {
           entries {
             progress
             status
             updatedAt
             createdAt
             media {
               id
               idMal
               title { romaji english }
               coverImage { large }
               episodes
             }
           }
         }
       }
     }`,
    { userId: viewer.Viewer.id },
    { accessToken }
  );

  // AniList returns one list per status, and custom lists can repeat an entry.
  // Deduplicate on media id so a show in a custom list isn't inserted twice.
  const byMediaId = new Map<number, ViewerListEntry>();
  for (const list of data.MediaListCollection.lists) {
    for (const entry of list.entries) {
      if (!byMediaId.has(entry.media.id)) byMediaId.set(entry.media.id, entry);
    }
  }

  return [...byMediaId.values()];
}

export type AiringSchedule = {
  anilistMediaId: number;
  /** Null when the show is not currently releasing. */
  nextAiringAt: Date | null;
  nextAiringEpisode: number | null;
};

/** AniList caps Page(media: id_in:) at 50 ids per request. */
const AIRING_CHUNK = 50;

/**
 * Broadcast times for a set of anime. Public data, so no access token is
 * needed — which is what lets the background poller run without a session.
 * Ids AniList does not return are simply absent from the result.
 */
export async function airingSchedules(
  mediaIds: number[]
): Promise<AiringSchedule[]> {
  const schedules: AiringSchedule[] = [];

  for (let i = 0; i < mediaIds.length; i += AIRING_CHUNK) {
    const ids = mediaIds.slice(i, i + AIRING_CHUNK);

    const data = await anilistRequest<{
      Page: {
        media: Array<{
          id: number;
          nextAiringEpisode: { episode: number; airingAt: number } | null;
        }>;
      };
    }>(
      `query ($ids: [Int]) {
         Page(perPage: ${AIRING_CHUNK}) {
           media(id_in: $ids, type: ANIME) {
             id
             nextAiringEpisode { episode airingAt }
           }
         }
       }`,
      { ids }
    );

    for (const media of data.Page.media) {
      schedules.push({
        anilistMediaId: media.id,
        nextAiringAt: media.nextAiringEpisode
          ? new Date(media.nextAiringEpisode.airingAt * 1000)
          : null,
        nextAiringEpisode: media.nextAiringEpisode?.episode ?? null,
      });
    }
  }

  return schedules;
}

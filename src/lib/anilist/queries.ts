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

export type ViewerListEntry = {
  progress: number;
  status: string | null;
  media: AniListMedia;
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
             media { ${MEDIA_FIELDS} }
           }
         }
       }
     }`,
    { userId: viewer.Viewer.id },
    { accessToken }
  );

  return data.MediaListCollection.lists.flatMap((list) => list.entries);
}

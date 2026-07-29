/**
 * Reading the user's MyAnimeList list. The rest of the app only ever wrote to
 * MAL (see lib/sync/progress.ts); mirroring needs to know what is actually
 * there before it can say what differs.
 */

export class MalError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "MalError";
    this.status = status;
  }
}

export type MalListEntry = {
  malMediaId: number;
  title: string;
  progress: number;
  /** Raw MAL status: watching, completed, on_hold, dropped, plan_to_watch. */
  status: string;
  isRewatching: boolean;
  /** MAL always reports a real timestamp here, unlike AniList's updatedAt. */
  updatedAt: Date | null;
};

/** MAL caps a page at 1000; anything larger is silently truncated. */
const PAGE_SIZE = 1000;

/** Guards against a malformed paging cursor looping forever. */
const MAX_PAGES = 20;

type MalListResponse = {
  data: Array<{
    node: { id: number; title: string };
    list_status?: {
      status?: string;
      num_episodes_watched?: number;
      is_rewatching?: boolean;
      updated_at?: string;
    };
  }>;
  paging?: { next?: string };
};

export async function viewerMalList(
  accessToken: string
): Promise<MalListEntry[]> {
  let url =
    `https://api.myanimelist.net/v2/users/@me/animelist` +
    `?fields=list_status&limit=${PAGE_SIZE}&nsfw=true`;

  const entries: MalListEntry[] = [];

  for (let page = 0; page < MAX_PAGES && url; page++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new MalError(
        response.status,
        response.status === 401
          ? "MyAnimeList rejected the token. Link the account again."
          : `MyAnimeList returned ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`
      );
    }

    const json = (await response.json()) as MalListResponse;

    for (const item of json.data ?? []) {
      const listStatus = item.list_status;
      if (!listStatus) continue;

      entries.push({
        malMediaId: item.node.id,
        title: item.node.title,
        progress: listStatus.num_episodes_watched ?? 0,
        status: listStatus.status ?? "watching",
        isRewatching: listStatus.is_rewatching ?? false,
        updatedAt: listStatus.updated_at
          ? new Date(listStatus.updated_at)
          : null,
      });
    }

    url = json.paging?.next ?? "";
  }

  return entries;
}

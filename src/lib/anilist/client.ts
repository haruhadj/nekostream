const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export class AniListError extends Error {
  status: number;
  /** Seconds to wait, when AniList reports a rate limit. */
  retryAfter: number | null;

  constructor(
    message: string,
    { status = 500, retryAfter = null as number | null } = {}
  ) {
    super(message);
    this.name = "AniListError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; status?: number }>;
};

/**
 * Search and metadata reads work unauthenticated; pass a token only for
 * viewer-scoped queries and list mutations.
 */
export async function anilistRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  {
    accessToken,
    timeoutMs = 15_000,
  }: { accessToken?: string | null; timeoutMs?: number } = {}
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new AniListError("Could not reach AniList.", { status: 502 });
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new AniListError("AniList is rate limiting this server.", {
      status: 429,
      retryAfter: Number.isFinite(retryAfter) ? retryAfter : null,
    });
  }

  const json = (await response
    .json()
    .catch(() => null)) as GraphQLResponse<T> | null;

  if (!json) {
    throw new AniListError("AniList returned a malformed response.", {
      status: 502,
    });
  }

  if (json.errors?.length) {
    throw new AniListError(json.errors[0].message, {
      status: json.errors[0].status ?? response.status,
    });
  }

  if (!response.ok || !json.data) {
    throw new AniListError(`AniList returned ${response.status}.`, {
      status: response.status,
    });
  }

  return json.data;
}

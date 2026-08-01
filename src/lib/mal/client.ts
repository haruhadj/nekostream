/**
 * The single way this app talks to the MyAnimeList API.
 *
 * There were four hand-rolled copies of this before, with three different
 * error types and two different truncation lengths, so the message a user saw
 * depended on which code path happened to make the call.
 */

export class MalError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "MalError";
    this.status = status;
  }
}

/** MAL is slow on large list pages; reads override the default. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** Enough of MAL's error body to be diagnostic without flooding a UI toast. */
const DETAIL_LIMIT = 80;

export async function malFetch(
  accessToken: string,
  url: string,
  init?: RequestInit & {
    timeoutMs?: number;
    /** For deletes, where "already absent" is the state the caller wanted. */
    allowNotFound?: boolean;
  }
) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, allowNotFound, ...rest } = init ?? {};

  const response = await fetch(url, {
    ...rest,
    headers: { ...rest.headers, Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (response.ok) return response;
  if (allowNotFound && response.status === 404) return response;

  throw new MalError(response.status, await describeFailure(response));
}

async function describeFailure(response: Response) {
  if (response.status === 401) {
    return "MyAnimeList rejected the token. Link the account again.";
  }

  const detail = await response.text().catch(() => "");
  const suffix = detail ? `: ${detail.slice(0, DETAIL_LIMIT)}` : "";

  return `MyAnimeList returned ${response.status}${suffix}`;
}

/**
 * Ported from src/lib/client/request.ts verbatim — the `ApiResult<T>`
 * discriminated union that never throws is exactly right here too.
 *
 * **On its way out.** Nothing sets a base URL any more: the server URL and the
 * better-auth cookie both went with STANDALONE.md's Phase 2, and Phase 3
 * replaces the screens' calls with local queries and direct AniList requests.
 * Until then the three data tabs still call `apiRequest`, so it reports the
 * situation plainly instead of failing as a mysterious network error.
 *
 * When the last caller is gone, so is this file.
 */

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number };

/** Shown when the request never reached the server at all. */
const UNREACHABLE = "Could not reach the server.";

/** Shown while a screen still reads from an API this app no longer talks to. */
const NOT_WIRED =
  "This screen still reads from the NekoStream server. It moves to the device in the next phase.";

let baseUrl = "";

/** No caller left — kept only until the last `apiRequest` caller is gone. */
export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/+$/, "");
}

export function getBaseUrl(): string {
  return baseUrl;
}

/** Was the better-auth session cookie; nothing sets it now. */
let authHeaders: () => Promise<Record<string, string>> = () =>
  Promise.resolve({});

export function setAuthHeadersProvider(
  provider: () => Promise<Record<string, string>>
): void {
  authHeaders = provider;
}

function resolveUrl(url: string): string {
  return url.startsWith("/") ? `${baseUrl}${url}` : url;
}

export async function apiRequest<T>(
  url: string,
  {
    fallbackError = "Something went wrong.",
    ...init
  }: RequestInit & { fallbackError?: string } = {}
): Promise<ApiResult<T>> {
  if (url.startsWith("/") && !baseUrl) {
    return { ok: false, error: NOT_WIRED, status: 0 };
  }

  let response: Response;

  try {
    response = await fetch(resolveUrl(url), {
      ...init,
      headers: { ...(await authHeaders()), ...init.headers },
      credentials: "omit",
    });
  } catch {
    return { ok: false, error: UNREACHABLE, status: 0 };
  }

  // An error page or a proxy timeout is not JSON; treat it as the failure it
  // is rather than letting the parse throw.
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      error: errorMessage(body) ?? fallbackError,
      status: response.status,
    };
  }

  return { ok: true, data: body as T, status: response.status };
}

/** Convenience for the common JSON POST/PUT/PATCH. */
export function apiSend<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  options: { fallbackError?: string } = {}
) {
  return apiRequest<T>(url, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
    ...options,
  });
}

function errorMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body) {
    const { error } = body;
    if (typeof error === "string" && error) return error;
  }
  return null;
}

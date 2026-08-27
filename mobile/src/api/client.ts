/**
 * Ported from src/lib/client/request.ts verbatim — the `ApiResult<T>`
 * discriminated union that never throws is exactly right here too, and its
 * "unreachable" branch matters far more on a phone than in a browser.
 *
 * Two additions over the web version, both because there is no ambient
 * origin or cookie jar on a phone:
 *  - every relative URL is prefixed with the operator's server URL, set via
 *    setBaseUrl() once server-url.tsx (Phase 3) has validated and persisted
 *    it.
 *  - an auth-header hook, wired up in Phase 3 to attach
 *    `Cookie: await authClient.getCookie()` — a no-op until then, so
 *    unauthenticated calls (GET /api/health) already work in Phase 2.
 */

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number };

/** Shown when the request never reached the server at all. */
const UNREACHABLE = "Could not reach the server.";

let baseUrl = "";

/** Set once the server URL screen (Phase 3) has validated and stored one. */
export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/+$/, "");
}

export function getBaseUrl(): string {
  return baseUrl;
}

/** Replaced in Phase 3 to attach the better-auth session cookie. */
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

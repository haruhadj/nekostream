/**
 * The one way client components call this app's API.
 *
 * Every component had its own copy of "fetch, parse, check res.ok, pull
 * json.error, fall back on a network failure". The copies disagreed about the
 * fallback wording, and three of them forgot the try/catch entirely, so a
 * dropped connection threw instead of showing a message.
 *
 * Returning a result rather than throwing keeps the caller's error path
 * visible: there is no way to use the data without having handled the failure.
 */

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number };

/** Shown when the request never reached the server at all. */
const UNREACHABLE = "Could not reach the server.";

export async function apiRequest<T>(
  url: string,
  {
    fallbackError = "Something went wrong.",
    ...init
  }: RequestInit & { fallbackError?: string } = {}
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    return { ok: false, error: UNREACHABLE, status: 0 };
  }

  // An error page or a proxy timeout is not JSON; treat it as the failure it is
  // rather than letting the parse throw.
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

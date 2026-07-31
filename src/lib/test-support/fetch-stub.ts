/**
 * A recording stand-in for global fetch.
 *
 * Not a test file itself (the runner globs `*.test.ts`) — shared setup for the
 * tests that pin the tracker HTTP contracts.
 */

export type RecordedCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
};

export type StubbedResponse = {
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
};

export type FetchStub = {
  calls: RecordedCall[];
  /** The single call made, asserting that exactly one was. */
  only(): RecordedCall;
  /** Form-encoded body of a call, parsed back into a plain object. */
  form(index?: number): Record<string, string>;
  /** GraphQL `{ query, variables }` body of a call. */
  graphql(index?: number): {
    query: string;
    variables: Record<string, unknown>;
  };
  restore(): void;
};

/**
 * Queues one response per expected call; the last queued response repeats if
 * more calls arrive, so tests only specify what they care about.
 */
export function stubFetch(responses: StubbedResponse[] = [{}]): FetchStub {
  const original = globalThis.fetch;
  const calls: RecordedCall[] = [];

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const spec = responses[Math.min(calls.length, responses.length - 1)] ?? {};

    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: normalizeHeaders(init?.headers),
      body: init?.body === undefined ? null : String(init.body),
    });

    const status = spec.status ?? 200;
    const payload =
      spec.text ?? (spec.json === undefined ? "{}" : JSON.stringify(spec.json));

    return Promise.resolve(
      new Response(payload, {
        status,
        headers: { "content-type": "application/json", ...spec.headers },
      })
    );
  }) as typeof fetch;

  const at = (index: number) => {
    const call = calls[index];
    if (!call) throw new Error(`No fetch call at index ${index}.`);
    return call;
  };

  return {
    calls,
    only() {
      if (calls.length !== 1) {
        throw new Error(`Expected exactly 1 fetch call, got ${calls.length}.`);
      }
      return calls[0];
    },
    form(index = 0) {
      return Object.fromEntries(new URLSearchParams(at(index).body ?? ""));
    },
    graphql(index = 0) {
      return JSON.parse(at(index).body ?? "{}") as {
        query: string;
        variables: Record<string, unknown>;
      };
    },
    restore() {
      globalThis.fetch = original;
    },
  };
}

function normalizeHeaders(headers: HeadersInit | undefined) {
  const out: Record<string, string> = {};
  if (!headers) return out;

  for (const [key, value] of new Headers(headers).entries()) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

/**
 * The pieces every route module needs.
 *
 * Each of these existed three or four times over, once per route file, and had
 * begun to drift — the same tracker failure produced a different status
 * depending on which module caught it.
 */

import { and, eq } from "drizzle-orm";
import type { Context, ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodType } from "zod";

import { db } from "@/db";
import { libraryEntry } from "@/db/schema";
import { AniListError } from "@/lib/anilist/client";
import { auth } from "@/lib/auth";
import { MalError } from "@/lib/mal/client";
import { NyaaFetchError } from "@/lib/nyaa/rss";
import { TokenError } from "@/lib/tokens";

export type Env = { Variables: { userId: string } };

/** Aborts the current handler with a JSON body, the way Hono expects. */
function abort(status: number, body: unknown): never {
  throw new HTTPException(status as 400, {
    res: Response.json(body, { status }),
  });
}

/** AniList sign-in gates every authenticated surface. */
export const requireSession: MiddlewareHandler<Env> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Sign in with AniList first." }, 401);

  c.set("userId", session.user.id);
  await next();
};

/**
 * Turns a failure from AniList, MyAnimeList or Nyaa into a status the client
 * can act on, and lets anything else surface as a 500.
 *
 * Registered with `onError` rather than written as a per-handler try/catch, so
 * a route that talks to a tracker simply lets the error propagate. Hono routes
 * handler errors here directly, not back up through the middleware chain.
 */
export const handleUpstreamErrors: ErrorHandler<Env> = (error, c) => {
  // Raised by the helpers below, and already carries its own response.
  if (error instanceof HTTPException) return error.getResponse();

  // A token the user must reconnect: which provider is the actionable part.
  if (error instanceof TokenError) {
    return c.json({ error: error.message, provider: error.provider }, 401);
  }

  // The tracker is reachable but unhappy — this server is the gateway. A rate
  // limit is passed through as 429 so the client can back off rather than
  // treating it as an outage.
  if (error instanceof AniListError) {
    return c.json({ error: error.message }, error.status === 429 ? 429 : 502);
  }

  if (error instanceof MalError || error instanceof NyaaFetchError) {
    return c.json({ error: error.message }, 502);
  }

  console.error("[routes] unhandled error", error);
  return c.json({ error: "Something went wrong." }, 500);
};

/** Scopes every lookup to the caller so ids from another account 404. */
export async function findEntry(userId: string, id: string) {
  const [entry] = await db
    .select()
    .from(libraryEntry)
    .where(and(eq(libraryEntry.id, id), eq(libraryEntry.userId, userId)))
    .limit(1);

  return entry ?? null;
}

/** The entry named by the ":id" param, or a 404. */
export async function requireEntry(c: Context<Env>) {
  const entry = await findEntry(c.get("userId"), c.req.param("id") ?? "");
  if (!entry) abort(404, { error: "Not in your library." });

  return entry;
}

/** The validated JSON body, or a 400 carrying the validation issues. */
export async function parseBody<T>(
  c: Context<Env>,
  schema: ZodType<T>,
  message: string
): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    abort(400, { error: message, issues: parsed.error.issues });

  return parsed.data;
}

/** A validated path or query param, or a 404 — an unknown name is not a route. */
export function parseParam<T>(
  schema: ZodType<T>,
  value: unknown,
  message: string
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) abort(404, { error: message });

  return parsed.data;
}

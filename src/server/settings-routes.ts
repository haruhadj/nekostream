import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { account, user } from "@/db/schema";
import { isEmailConfigured } from "@/lib/email/mailer";
import {
  handleUpstreamErrors,
  parseBody,
  requireSession,
  type Env,
} from "@/server/shared";

export const settingsRoutes = new Hono<Env>();

settingsRoutes.use("*", requireSession);
settingsRoutes.onError(handleUpstreamErrors);

/**
 * Which of the two trackers this user has linked. One query serves the
 * settings screen, the mirror gate, and the detail-page tracker-editor gate —
 * all of which used to run their own `listUserAccounts`/`account` query.
 */
async function linkedProviders(userId: string) {
  const rows = await db
    .select({ providerId: account.providerId })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        inArray(account.providerId, ["anilist", "mal"])
      )
    );

  return {
    anilistLinked: rows.some((r) => r.providerId === "anilist"),
    malLinked: rows.some((r) => r.providerId === "mal"),
  };
}

settingsRoutes.get("/", async (c) => {
  const userId = c.get("userId");

  const [row] = await db
    .select({
      notificationEmail: user.notificationEmail,
      notifyNewEpisodesByEmail: user.notifyNewEpisodesByEmail,
      anilistSyncedAt: user.anilistSyncedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const linked = await linkedProviders(userId);

  return c.json({
    notificationEmail: row?.notificationEmail ?? null,
    notifyNewEpisodesByEmail: row?.notifyNewEpisodesByEmail ?? false,
    emailConfigured: isEmailConfigured(),
    anilistSyncedAt: row?.anilistSyncedAt?.toISOString() ?? null,
    ...linked,
  });
});

/**
 * The toggle can't be turned on without an address to send to — AniList/MAL
 * give us no real email, so this is the only place one exists. Sending an
 * empty string clears the address, which also switches the toggle back off.
 */
const updateSchema = z
  .object({
    notificationEmail: z.email().nullable(),
    notifyNewEpisodesByEmail: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field.");

settingsRoutes.patch("/", async (c) => {
  const userId = c.get("userId");
  const data = await parseBody(c, updateSchema, "Invalid settings.");

  const [current] = await db
    .select({
      notificationEmail: user.notificationEmail,
      notifyNewEpisodesByEmail: user.notifyNewEpisodesByEmail,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const notificationEmail =
    data.notificationEmail !== undefined
      ? data.notificationEmail
      : (current?.notificationEmail ?? null);

  // Clearing the address makes it impossible to keep the toggle on.
  const notifyNewEpisodesByEmail =
    (data.notifyNewEpisodesByEmail ?? current?.notifyNewEpisodesByEmail ?? false) &&
    notificationEmail !== null;

  const [updated] = await db
    .update(user)
    .set({ notificationEmail, notifyNewEpisodesByEmail, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({
      notificationEmail: user.notificationEmail,
      notifyNewEpisodesByEmail: user.notifyNewEpisodesByEmail,
      anilistSyncedAt: user.anilistSyncedAt,
    });

  const linked = await linkedProviders(userId);

  return c.json({
    ...updated,
    anilistSyncedAt: updated?.anilistSyncedAt?.toISOString() ?? null,
    emailConfigured: isEmailConfigured(),
    ...linked,
  });
});

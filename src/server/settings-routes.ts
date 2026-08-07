import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { user } from "@/db/schema";
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

settingsRoutes.get("/", async (c) => {
  const [row] = await db
    .select({
      notificationEmail: user.notificationEmail,
      notifyNewEpisodesByEmail: user.notifyNewEpisodesByEmail,
    })
    .from(user)
    .where(eq(user.id, c.get("userId")))
    .limit(1);

  return c.json({
    notificationEmail: row?.notificationEmail ?? null,
    notifyNewEpisodesByEmail: row?.notifyNewEpisodesByEmail ?? false,
    emailConfigured: isEmailConfigured(),
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
  const data = await parseBody(c, updateSchema, "Invalid settings.");

  const [current] = await db
    .select({
      notificationEmail: user.notificationEmail,
      notifyNewEpisodesByEmail: user.notifyNewEpisodesByEmail,
    })
    .from(user)
    .where(eq(user.id, c.get("userId")))
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
    .where(eq(user.id, c.get("userId")))
    .returning({
      notificationEmail: user.notificationEmail,
      notifyNewEpisodesByEmail: user.notifyNewEpisodesByEmail,
    });

  return c.json({ ...updated, emailConfigured: isEmailConfigured() });
});

import { Hono } from "hono";
import { handle } from "hono/vercel";

import { auth } from "@/lib/auth";
import { anilistRoutes } from "@/server/anilist-routes";
import { libraryRoutes } from "@/server/library-routes";
import { mirrorRoutes } from "@/server/mirror-routes";
import { settingsRoutes } from "@/server/settings-routes";
import { stremioRoutes } from "@/server/stremio-routes";

// libsql's client is Node-only — the Edge runtime would break the DB layer.
export const runtime = "nodejs";

const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true, service: "nekostream" }));

// better-auth owns everything under /api/auth/*
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.route("/library", libraryRoutes);
app.route("/anilist", anilistRoutes);
app.route("/mirror", mirrorRoutes);
app.route("/settings", settingsRoutes);

// The addon speaks to Stremio, which can't send session cookies — it carries a
// secret token in its path instead, so it must not sit behind the auth guard.
app.route("/stremio", stremioRoutes);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

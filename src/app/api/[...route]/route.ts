import { Hono } from "hono";
import { handle } from "hono/vercel";

import { auth } from "@/lib/auth";
import { anilistRoutes } from "@/server/anilist-routes";
import { libraryRoutes } from "@/server/library-routes";
import { mirrorRoutes } from "@/server/mirror-routes";

// libsql's client is Node-only — the Edge runtime would break the DB layer.
export const runtime = "nodejs";

const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true, service: "nekostream" }));

// better-auth owns everything under /api/auth/*
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.route("/library", libraryRoutes);
app.route("/anilist", anilistRoutes);
app.route("/mirror", mirrorRoutes);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

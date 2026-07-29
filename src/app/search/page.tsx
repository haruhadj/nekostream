import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { SearchBrowser } from "@/components/search-browser";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/db";
import { libraryEntry } from "@/db/schema";
import { AniListError } from "@/lib/anilist/client";
import { trendingMedia, type AniListMedia } from "@/lib/anilist/queries";
import { auth } from "@/lib/auth";

export default async function SearchPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const owned = await db
    .select({ anilistMediaId: libraryEntry.anilistMediaId })
    .from(libraryEntry)
    .where(eq(libraryEntry.userId, session.user.id));

  // A trending failure shouldn't block the page — search still works.
  let trending: AniListMedia[] = [];
  let error: string | null = null;
  try {
    trending = (await trendingMedia()).media;
  } catch (e) {
    error = e instanceof AniListError ? e.message : "Could not reach AniList.";
  }

  return (
    <>
      <SiteHeader active="search" />

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="mt-2 text-sm text-muted">
          Results come from AniList. Adding a title saves it to this server.
        </p>

        {error ? (
          <p className="mt-6 rounded-xl border border-edge bg-surface/50 px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        <div className="mt-7">
          <SearchBrowser
            initialMedia={trending}
            libraryMediaIds={owned.map((o) => o.anilistMediaId)}
          />
        </div>
      </main>
    </>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { SiteHeader } from "@/components/site-header";
import { db } from "@/db";
import { libraryEntry } from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function LibraryPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const entries = await db
    .select()
    .from(libraryEntry)
    .where(eq(libraryEntry.userId, session.user.id))
    .orderBy(asc(libraryEntry.titleRomaji));

  return (
    <>
      <SiteHeader active="library" />

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-muted">
            {entries.length} {entries.length === 1 ? "title" : "titles"}
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-edge p-10 text-center">
            <p className="text-sm text-muted">
              Nothing here yet. Find an anime and add it to start tracking
              episodes.
            </p>
            <Link
              href="/search"
              className="mt-5 inline-block rounded-xl bg-anilist px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
            >
              Search anime
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link href={`/anime/${entry.id}`} className="group block">
                  <div className="aspect-[2/3] overflow-hidden rounded-xl border border-edge bg-surface">
                    {entry.coverImageUrl ? (
                      /* AniList CDN images; a plain img avoids remote-host
                         config for a domain the user can't change. */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : null}
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-anilist">
                    {entry.titleEnglish ?? entry.titleRomaji}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {entry.progress}
                    {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""} watched
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

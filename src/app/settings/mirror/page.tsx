import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MirrorReview } from "@/components/mirror-review";
import { SiteHeader } from "@/components/site-header";
import { auth } from "@/lib/auth";

export default async function MirrorPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });
  const malLinked = accounts.some((a) => a.providerId === "mal");

  return (
    <>
      <SiteHeader />

      <main className="pb-tabbar mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-16">
        <Link
          href="/settings"
          className="-ml-2 inline-flex min-h-10 items-center rounded-full px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted transition-colors hover:text-foreground"
        >
          ← Settings
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Mirror AniList and MyAnimeList
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Titles are paired by their MyAnimeList id, which AniList supplies
          directly — no title matching is involved. Where the two disagree, you
          pick which one is right; nothing is written until you do.
        </p>

        <div className="mt-8">
          {malLinked ? (
            <MirrorReview />
          ) : (
            <p className="rounded-xl border border-border bg-surface/50 px-4 py-3 text-sm text-muted">
              Link MyAnimeList first — there is nothing to compare against until
              then.{" "}
              <Link href="/settings" className="underline underline-offset-2">
                Go to settings
              </Link>
            </p>
          )}
        </div>
      </main>
    </>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ScheduleList } from "@/components/schedule-list";
import { SiteHeader } from "@/components/site-header";
import { auth } from "@/lib/auth";
import { getScheduleEntries } from "@/lib/library/schedule";

export default async function SchedulePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const entries = await getScheduleEntries(session.user.id);

  return (
    <>
      <SiteHeader active="schedule" />

      <main className="pb-tabbar mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-2xl">
          Schedule
        </h1>
        <p className="mt-2 text-sm text-muted">
          The next episode for everything in your library that&rsquo;s still
          airing.
        </p>

        {entries.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border bg-surface/20 px-6 py-12 text-center sm:p-10">
            <p className="mx-auto max-w-xs text-balance text-sm leading-relaxed text-muted">
              Nothing airing right now. Shows with a broadcast still ahead
              will show up here.
            </p>
          </div>
        ) : (
          <ScheduleList entries={entries} />
        )}
      </main>
    </>
  );
}

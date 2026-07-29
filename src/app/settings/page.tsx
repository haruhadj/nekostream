import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { OAuthButton } from "@/components/oauth-button";
import { auth } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // AniList gates everything — MAL linking is only reachable once signed in.
  if (!session) redirect("/login");

  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });
  const malLinked = accounts.some((a) => a.providerId === "mal");

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        Settings
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Connected accounts
      </h1>

      <section className="mt-8 rounded-2xl border border-edge bg-surface/50 p-6">
        <h2 className="text-sm font-semibold">MyAnimeList</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {malLinked
            ? "Linked. Progress updates are written to AniList and MyAnimeList together."
            : "Link MyAnimeList to write progress updates to both lists at once."}
        </p>

        {!malLinked && (
          <div className="mt-5 max-w-xs">
            <OAuthButton
              provider="mal"
              variant="secondary"
              callbackURL="/settings"
            />
          </div>
        )}
      </section>
    </main>
  );
}

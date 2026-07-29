import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { OAuthButton } from "@/components/oauth-button";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteHeader } from "@/components/site-header";
import { auth } from "@/lib/auth";

/** Error codes better-auth appends to the callback URL when linking fails. */
const LINK_ERRORS: Record<string, string> = {
  account_already_linked_to_different_user:
    "That MyAnimeList account is already attached to another NekoStream user. Sign in as that user and unlink it first.",
  email_doesn_t_match:
    "MyAnimeList could not be matched to this account. Try linking again.",
  "email_doesn't_match":
    "MyAnimeList could not be matched to this account. Try linking again.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  // AniList gates everything — MAL linking is only reachable once signed in.
  if (!session) redirect("/login");

  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });
  const anilistLinked = accounts.some((a) => a.providerId === "anilist");
  const malLinked = accounts.some((a) => a.providerId === "mal");

  const { error } = await searchParams;
  const linkError = error
    ? (LINK_ERRORS[error] ?? "Linking failed. Try again.")
    : null;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          Settings
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Connected accounts
        </h1>

        {linkError ? (
          <p className="mt-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {linkError}
          </p>
        ) : null}

        <section className="mt-8 rounded-2xl border border-edge bg-surface/50 p-6">
          <h2 className="text-sm font-semibold">AniList</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {anilistLinked
              ? `Connected as ${session.user.name}. Your list is imported here and progress is written back.`
              : "Not connected. Sign out and sign back in with AniList to restore access to your list."}
          </p>

          {!anilistLinked && (
            <div className="mt-5 max-w-xs">
              <OAuthButton
                provider="anilist"
                mode="link"
                callbackURL="/settings"
              />
            </div>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-edge bg-surface/50 p-6">
          <h2 className="text-sm font-semibold">MyAnimeList</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {malLinked
              ? "Linked. Progress updates are written to AniList and MyAnimeList together."
              : "Link MyAnimeList to write progress updates to both lists at once."}
          </p>

          {malLinked ? (
            <Link
              href="/settings/mirror"
              className="mt-5 inline-block rounded-xl border border-edge bg-surface/60 px-4 py-2.5 text-sm font-semibold transition hover:border-anilist/60"
            >
              Compare both lists →
            </Link>
          ) : (
            <div className="mt-5 max-w-xs">
              <OAuthButton
                provider="mal"
                variant="secondary"
                mode="link"
                callbackURL="/settings"
              />
            </div>
          )}
        </section>

        <section className="mt-10 border-t border-edge pt-8">
          <h2 className="text-sm font-semibold">Session</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Signing out leaves your library on this server — signing back in
            with AniList picks it up again.
          </p>
          <div className="mt-5">
            <SignOutButton />
          </div>
        </section>
      </main>
    </>
  );
}

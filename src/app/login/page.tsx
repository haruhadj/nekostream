import { OAuthButton } from "@/components/oauth-button";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          NekoStream
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-balance">
          Your list, your episodes, your server.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Sign in with AniList to pull in your library. Everything after that
          stays on this machine.
        </p>

        <div className="mt-9">
          <OAuthButton provider="anilist" callbackURL="/" />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          You can link MyAnimeList later in settings to keep both lists in sync.
        </p>
      </div>
    </main>
  );
}

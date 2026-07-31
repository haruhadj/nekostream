"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import type { Provider } from "@/lib/providers";

const PROVIDERS = {
  anilist: {
    label: "Continue with AniList",
    brand: "var(--anilist)",
    onBrand: "#04131f",
    Mark: AniListMark,
  },
  mal: {
    label: "Link MyAnimeList",
    brand: "var(--mal)",
    onBrand: "#ffffff",
    Mark: MalMark,
  },
} satisfies Record<
  Provider,
  { label: string; brand: string; onBrand: string; Mark: () => React.ReactNode }
>;

/**
 * "signIn" starts a new session; "link" attaches the provider to the session
 * that already exists. Linking MAL through signIn would match on email — and
 * since both providers hand out synthesized placeholder emails that never
 * agree, it silently creates a second, empty user instead of linking.
 */
type Mode = "signIn" | "link";

export function OAuthButton({
  provider,
  variant = "primary",
  callbackURL = "/",
  mode = "signIn",
  errorCallbackURL,
}: {
  provider: Provider;
  variant?: "primary" | "secondary";
  callbackURL?: string;
  mode?: Mode;
  errorCallbackURL?: string;
}) {
  const [pending, setPending] = useState(false);
  const { label, brand, onBrand, Mark } = PROVIDERS[provider];

  async function connect() {
    setPending(true);
    try {
      if (mode === "link") {
        await authClient.oauth2.link({
          providerId: provider,
          callbackURL,
          errorCallbackURL: errorCallbackURL ?? callbackURL,
        });
      } else {
        await authClient.signIn.oauth2({ providerId: provider, callbackURL });
      }
    } finally {
      setPending(false);
    }
  }

  const primary = variant === "primary";

  return (
    <button
      type="button"
      onClick={connect}
      disabled={pending}
      style={
        primary
          ? { background: brand, color: onBrand }
          : { borderColor: brand, color: "var(--cream)" }
      }
      className={[
        "group relative flex w-full items-center justify-center gap-3",
        "rounded-xl px-5 py-3.5 text-[15px] font-semibold tracking-tight",
        "transition duration-200 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cream",
        "disabled:cursor-wait disabled:opacity-60",
        primary
          ? "shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_30px_-12px_var(--anilist)] hover:brightness-110 active:translate-y-px"
          : "border bg-surface/60 hover:bg-surface active:translate-y-px",
      ].join(" ")}
    >
      <span className="shrink-0" aria-hidden="true">
        <Mark />
      </span>
      {pending ? "Opening…" : label}
    </button>
  );
}

/**
 * Typographic marks rather than the official logo artwork — the real AniList and
 * MAL logos are trademarked assets that should be dropped in as files if wanted.
 */
function AniListMark() {
  return <LetterMark>A</LetterMark>;
}

function MalMark() {
  return <LetterMark>MAL</LetterMark>;
}

function LetterMark({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-current/50 px-1.5 text-[10px] font-black leading-none tracking-[0.08em] opacity-90">
      {children}
    </span>
  );
}

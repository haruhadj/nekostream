"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await authClient.signOut();
      // Server components hold the session-derived markup, so a plain push
      // would render the cached signed-in tree.
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={[
        "w-full rounded-xl border border-edge bg-surface/60 px-5 py-3",
        "text-sm font-semibold tracking-tight text-cream",
        "transition duration-200 ease-out hover:border-rose-500/60 hover:text-rose-400",
        "focus-ring",
        "active:translate-y-px disabled:cursor-wait disabled:opacity-60",
        "sm:w-auto",
      ].join(" ")}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

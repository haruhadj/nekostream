"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EntrySettings({
  entryId,
  syncAnilist,
  syncMal,
  malLinked,
}: {
  entryId: string;
  syncAnilist: boolean;
  syncMal: boolean;
  /** MAL sync can't be enabled before the account is linked in settings. */
  malLinked: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ syncAnilist, syncMal });
  const [busy, setBusy] = useState(false);

  async function toggle(field: "syncAnilist" | "syncMal") {
    const next = { ...state, [field]: !state[field] };
    setState(next);
    setBusy(true);

    const res = await fetch(`/api/library/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: next[field] }),
    });

    if (!res.ok) setState(state); // revert on failure
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Toggle
        label="Sync AniList"
        checked={state.syncAnilist}
        disabled={busy}
        onChange={() => toggle("syncAnilist")}
      />
      <Toggle
        label={malLinked ? "Sync MyAnimeList" : "Sync MyAnimeList (link first)"}
        checked={state.syncMal}
        disabled={busy || !malLinked}
        onChange={() => toggle("syncMal")}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={[
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-anilist text-ink" : "border border-edge text-muted",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "h-1.5 w-1.5 rounded-full",
          checked ? "bg-ink" : "bg-muted",
        ].join(" ")}
      />
      {label}
    </button>
  );
}

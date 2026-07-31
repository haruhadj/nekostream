"use client";

import { useState } from "react";

import { NyaaFilterSetup } from "@/components/nyaa-filter-setup";
import type { SavedFilter } from "@/lib/nyaa/filter";

/**
 * With no saved feed the setup form opens immediately — plan.md wants the Nyaa
 * search shown the first time an anime is added. Afterwards it collapses to a
 * summary the user can reopen.
 */
export function NyaaFilterPanel({
  entryId,
  defaultTitle,
  savedFilter,
}: {
  entryId: string;
  defaultTitle: string;
  savedFilter: SavedFilter | null;
}) {
  const [editing, setEditing] = useState(!savedFilter);

  if (editing) {
    return (
      <div>
        <NyaaFilterSetup
          entryId={entryId}
          defaultTitle={defaultTitle}
          savedFilter={savedFilter}
          onDone={() => setEditing(false)}
        />
        {savedFilter ? (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="mt-3 text-xs text-muted transition-colors hover:text-cream"
          >
            Cancel
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-edge bg-surface/50 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Nyaa feed
        </p>
        <p className="mt-1 truncate font-mono text-xs text-cream">
          {savedFilter?.query}
        </p>
      </div>

      <a
        href={`https://nyaa.si/?q=${encodeURIComponent(savedFilter?.query ?? "")}&c=${savedFilter?.category ?? "1_2"}&f=${savedFilter?.filter ?? "0"}`}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-muted transition-colors hover:text-cream"
      >
        Open on Nyaa ↗
      </a>

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium transition hover:bg-surface"
      >
        Change feed
      </button>
    </section>
  );
}

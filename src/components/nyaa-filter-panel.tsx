"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { NyaaFilterSetup } from "@/components/nyaa-filter-setup";
import { Button } from "@/components/ui/button";
import { apiSend } from "@/lib/client/request";
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
  const router = useRouter();
  const [editing, setEditing] = useState(!savedFilter);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (
      !confirm(
        "Stop tracking Nyaa for this anime? Episodes already found stay in the list, but nothing new will be fetched until a feed is set up again."
      )
    )
      return;

    setRemoving(true);
    setError(null);
    try {
      const result = await apiSend(
        `/api/library/${entryId}/filter`,
        "DELETE",
        undefined,
        { fallbackError: "Could not remove the feed." }
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

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
            className="mt-3 text-xs text-muted transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <section className="card px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Nyaa feed
          </p>
          <p className="mt-1 truncate font-mono text-xs text-foreground">
            {savedFilter?.query}
          </p>
        </div>

        <a
          href={`https://nyaa.si/?q=${encodeURIComponent(savedFilter?.query ?? "")}&c=${savedFilter?.category ?? "1_2"}&f=${savedFilter?.filter ?? "0"}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
        >
          Open on Nyaa
          <ExternalLink aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
        </a>

        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Change feed
        </Button>

        <Button variant="destructive" size="sm" onClick={remove} disabled={removing}>
          {removing ? "Removing…" : "Stop tracking"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
    </section>
  );
}

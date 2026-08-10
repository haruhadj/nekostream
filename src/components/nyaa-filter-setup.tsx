"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, apiSend } from "@/lib/client/request";
import type { DiscoveryResult } from "@/lib/nyaa/discover";
import type { SavedFilter } from "@/lib/nyaa/filter";

/**
 * Shown immediately after an anime is added (plan.md), and reopenable later to
 * change the feed. Probes Nyaa so the user picks from real groups and
 * qualities instead of typing a query blind.
 */
export function NyaaFilterSetup({
  entryId,
  defaultTitle,
  savedFilter,
  onDone,
}: {
  entryId: string;
  defaultTitle: string;
  savedFilter: SavedFilter | null;
  onDone?: () => void;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(savedFilter?.query ?? defaultTitle);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [group, setGroup] = useState<string | null>(
    savedFilter?.releaseGroup ?? null
  );
  const [quality, setQuality] = useState<string | null>(
    savedFilter?.quality ?? null
  );

  const [probing, setProbing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function probe(searchTitle: string) {
    setProbing(true);
    setError(null);
    try {
      const result = await apiRequest<DiscoveryResult>(
        `/api/library/${entryId}/discover?q=${encodeURIComponent(searchTitle)}`,
        { fallbackError: "Could not search Nyaa." }
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const discovered = result.data;
      setDiscovery(discovered);

      // Only preselect when the user hasn't already chosen.
      setQuality((q) => q ?? discovered.defaultQuality);
      setGroup(
        (g) =>
          g ??
          discovered.groups.find((x) => x.recommended)?.releaseGroup ??
          null
      );
    } finally {
      setProbing(false);
    }
  }

  // Probe once on open so the picker is never empty. This is a fetch on mount,
  // which is exactly what an effect is for.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void probe(title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const composedQuery = [title, quality, group].filter(Boolean).join(" ");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await apiSend(
        `/api/library/${entryId}/filter`,
        "PUT",
        {
          query: composedQuery,
          category: savedFilter?.category ?? "1_2",
          filter: savedFilter?.filter ?? "0",
          releaseGroup: group,
          quality,
        },
        { fallbackError: "Could not save the filter." }
      );

      if (!saved.ok) {
        setError(saved.error);
        return;
      }

      // Populate the episode list straight away — saving a feed with no
      // episodes behind it would look broken. A failure here is worth saying
      // out loud: the feed saved but the list will look empty until a manual
      // refresh. Previously the response was discarded entirely.
      const refreshed = await apiSend(
        `/api/library/${entryId}/refresh`,
        "POST",
        undefined,
        { fallbackError: "Saved, but could not load episodes yet." }
      );

      if (!refreshed.ok) setError(refreshed.error);

      router.refresh();
      onDone?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-6">
      <h2 className="text-sm font-semibold">Nyaa feed</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Pick a release group and quality. The episode list is built from this
        search.
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Search terms"
          className="flex-1"
        />
        <Button variant="outline" onClick={() => probe(title)} disabled={probing}>
          {probing ? "Searching…" : "Search Nyaa"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm">{error}</p> : null}

      {discovery ? (
        <>
          <Picker
            label="Quality"
            options={discovery.qualities}
            selected={quality}
            onSelect={setQuality}
          />

          <Picker
            label="Release group"
            options={discovery.groups.map((g) => g.releaseGroup)}
            hints={Object.fromEntries(
              discovery.groups.map((g) => [
                g.releaseGroup,
                `${g.releaseCount} releases`,
              ])
            )}
            selected={group}
            onSelect={setGroup}
          />

          {discovery.groups.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No releases matched. Try different search terms.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs text-muted">Feed search</p>
        <p className="mt-1 break-all font-mono text-xs text-foreground">
          {composedQuery || "—"}
        </p>

        <Button
          className="mt-4"
          onClick={save}
          disabled={saving || !composedQuery.trim()}
        >
          {saving ? "Saving…" : "Save feed and load episodes"}
        </Button>
      </div>
    </section>
  );
}

function Picker({
  label,
  options,
  hints,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  hints?: Record<string, string>;
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isSelected}
              // Clicking the active chip clears it — "any group" is valid.
              onClick={() => onSelect(isSelected ? null : option)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                "focus-ring",
                isSelected
                  ? "bg-accent text-accent-foreground"
                  : "border border-border text-foreground hover:bg-surface",
              ].join(" ")}
            >
              {option}
              {hints?.[option] ? (
                <span className={isSelected ? "opacity-70" : "text-muted"}>
                  {" "}
                  · {hints[option]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

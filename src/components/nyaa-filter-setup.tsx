"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { DiscoveryResult } from "@/lib/nyaa/discover";

type SavedFilter = {
  query: string;
  category: string;
  filter: string;
  releaseGroup: string | null;
  quality: string | null;
};

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
      const res = await fetch(
        `/api/library/${entryId}/discover?q=${encodeURIComponent(searchTitle)}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not search Nyaa.");
        return;
      }

      setDiscovery(json);
      // Only preselect when the user hasn't already chosen.
      setQuality((q) => q ?? json.defaultQuality);
      setGroup(
        (g) =>
          g ??
          json.groups.find((x: { recommended: boolean }) => x.recommended)
            ?.releaseGroup ??
          null
      );
    } catch {
      setError("Could not reach the server.");
    } finally {
      setProbing(false);
    }
  }

  // Probe once on open so the picker is never empty.
  useEffect(() => {
    void probe(title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const composedQuery = [title, quality, group].filter(Boolean).join(" ");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/library/${entryId}/filter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: composedQuery,
          category: savedFilter?.category ?? "1_2",
          filter: savedFilter?.filter ?? "0",
          releaseGroup: group,
          quality,
        }),
      });

      if (!res.ok) {
        setError((await res.json()).error ?? "Could not save the filter.");
        return;
      }

      // Populate the episode list straight away — saving a feed with no
      // episodes behind it would look broken.
      await fetch(`/api/library/${entryId}/refresh`, { method: "POST" });

      router.refresh();
      onDone?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-edge bg-surface/50 p-6">
      <h2 className="text-sm font-semibold">Nyaa feed</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Pick a release group and quality. The episode list is built from this
        search.
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Search terms"
          className="flex-1 rounded-lg border border-edge bg-ink px-3 py-2 text-sm focus:border-anilist focus:outline-none"
        />
        <button
          type="button"
          onClick={() => probe(title)}
          disabled={probing}
          className="rounded-lg border border-edge px-4 py-2 text-sm font-medium transition hover:bg-surface disabled:opacity-60"
        >
          {probing ? "Searching…" : "Search Nyaa"}
        </button>
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

      <div className="mt-6 border-t border-edge pt-5">
        <p className="text-xs text-muted">Feed search</p>
        <p className="mt-1 break-all font-mono text-xs text-cream">
          {composedQuery || "—"}
        </p>

        <button
          type="button"
          onClick={save}
          disabled={saving || !composedQuery.trim()}
          className="mt-4 rounded-xl bg-anilist px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save feed and load episodes"}
        </button>
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
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream",
                isSelected
                  ? "bg-anilist text-ink"
                  : "border border-edge text-cream hover:bg-surface",
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useProgress } from "@/components/progress-control";
import { formatBytes, formatRelative } from "@/lib/format";

export type EpisodeRow = {
  id: string;
  episodeNumber: number | null;
  rawTitle: string;
  releaseGroup: string | null;
  quality: string | null;
  magnetUri: string;
  sizeBytes: number | null;
  seeders: number | null;
  publishedAt: string | null;
};

export function EpisodeList({
  entryId,
  episodes,
  lastFetchedAt,
  hasFilter,
}: {
  entryId: string;
  episodes: EpisodeRow[];
  lastFetchedAt: string | null;
  hasFilter: boolean;
}) {
  const router = useRouter();
  const { progress, saving, setProgress } = useProgress();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/library/${entryId}/refresh`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error ?? "Refresh failed.");
        return;
      }

      setMessage(
        json.added === 0
          ? "No new episodes."
          : `Added ${json.added} new ${json.added === 1 ? "release" : "releases"}.`
      );
      router.refresh();
    } catch {
      setMessage("Could not reach the server.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Episodes</h2>

        <div className="flex items-center gap-3">
          <p className="text-xs text-muted" aria-live="polite">
            {message ??
              (lastFetchedAt
                ? `Checked ${formatRelative(lastFetchedAt)}`
                : "Not checked yet")}
          </p>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || !hasFilter}
            className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium transition hover:bg-surface disabled:opacity-50"
          >
            {refreshing ? "Checking…" : "Refresh"}
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
          {hasFilter
            ? "No releases found for this feed yet."
            : "Save a Nyaa feed to build the episode list."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-edge overflow-hidden rounded-xl border border-edge">
          {episodes.map((ep) => {
            const watched =
              ep.episodeNumber !== null && ep.episodeNumber <= progress;

            return (
            <li
              key={ep.id}
              className={[
                "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3",
                watched ? "bg-surface/10" : "bg-surface/30",
              ].join(" ")}
            >
              <span
                className={[
                  "w-12 shrink-0 font-mono text-sm",
                  watched ? "text-muted" : "text-cream",
                ].join(" ")}
              >
                {ep.episodeNumber !== null ? `#${ep.episodeNumber}` : "—"}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" title={ep.rawTitle}>
                  {ep.rawTitle}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {[
                    ep.releaseGroup,
                    ep.quality,
                    formatBytes(ep.sizeBytes),
                    ep.seeders !== null ? `${ep.seeders} seeders` : null,
                    formatRelative(ep.publishedAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              {ep.episodeNumber !== null ? (
                <button
                  type="button"
                  disabled={saving}
                  // Marking episode N watched means progress is at least N.
                  onClick={() =>
                    setProgress(watched ? ep.episodeNumber! - 1 : ep.episodeNumber!)
                  }
                  className="shrink-0 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface hover:text-cream disabled:opacity-50"
                >
                  {watched ? "Watched" : "Mark watched"}
                </button>
              ) : null}

              {/* A plain anchor so the OS hands magnets to the user's torrent
                  client, exactly as plan.md asks. */}
              <a
                href={ep.magnetUri}
                className="shrink-0 rounded-lg bg-anilist px-3 py-1.5 text-xs font-semibold text-ink transition hover:brightness-110"
              >
                Magnet
              </a>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

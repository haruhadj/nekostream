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
      {/* Stacks on mobile: the status line and Refresh have no room to share a
          baseline with the heading at phone width. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-3">
        <h2 className="text-sm font-semibold">Episodes</h2>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
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
            className="min-h-10 shrink-0 rounded-full border border-edge px-4 text-xs font-medium transition hover:bg-surface active:scale-[0.97] disabled:opacity-50 sm:min-h-0 sm:py-1.5"
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
        <ul className="mt-4 divide-y divide-edge overflow-hidden rounded-2xl border border-edge">
          {episodes.map((ep) => {
            const watched =
              ep.episodeNumber !== null && ep.episodeNumber <= progress;

            return (
            <li
              key={ep.id}
              className={[
                // Two tiers on mobile — details above, actions below — folding
                // into a single row once there is width for it.
                "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4",
                watched ? "bg-surface/10" : "bg-surface/30",
              ].join(" ")}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className={[
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs tabular-nums",
                    watched
                      ? "border-anilist/40 bg-anilist/10 text-anilist"
                      : "border-edge bg-ink/30 text-cream",
                  ].join(" ")}
                >
                  {ep.episodeNumber !== null ? ep.episodeNumber : "—"}
                </span>

                <div className="min-w-0 flex-1">
                  {/* Release titles run long; two lines on mobile beats
                      truncating them to nothing. */}
                  <p
                    className="line-clamp-2 text-sm leading-snug sm:truncate"
                    title={ep.rawTitle}
                  >
                    {ep.rawTitle}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted">
                    {[
                      ep.releaseGroup,
                      ep.quality,
                      formatBytes(ep.sizeBytes),
                      ep.seeders !== null ? `${ep.seeders} seeders` : null,
                      formatRelative(ep.publishedAt),
                    ]
                      .filter(Boolean)
                      .map((bit, i) => (
                        <span key={i}>{bit}</span>
                      ))}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                {ep.episodeNumber !== null ? (
                  <button
                    type="button"
                    disabled={saving}
                    // Marking episode N watched means progress is at least N.
                    onClick={() =>
                      setProgress(watched ? ep.episodeNumber! - 1 : ep.episodeNumber!)
                    }
                    className={[
                      "min-h-11 flex-1 rounded-full border px-4 text-xs font-medium transition",
                      "active:scale-[0.97] disabled:opacity-50 sm:min-h-0 sm:flex-none sm:py-1.5",
                      watched
                        ? "border-anilist/40 text-anilist"
                        : "border-edge text-muted hover:bg-surface hover:text-cream",
                    ].join(" ")}
                  >
                    {watched ? "Watched" : "Mark watched"}
                  </button>
                ) : null}

                {/* A plain anchor so the OS hands magnets to the user's torrent
                    client, exactly as plan.md asks. */}
                <a
                  href={ep.magnetUri}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-anilist px-5 text-xs font-semibold text-ink transition hover:brightness-110 active:scale-[0.97] sm:min-h-0 sm:flex-none sm:py-1.5"
                >
                  Magnet
                </a>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

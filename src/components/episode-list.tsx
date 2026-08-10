"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/client/request";

import { useProgress } from "@/components/progress-control";
import { Button, buttonVariants } from "@/components/ui/button";
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
      const result = await apiSend<{ added: number }>(
        `/api/library/${entryId}/refresh`,
        "POST",
        undefined,
        { fallbackError: "Refresh failed." }
      );

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      const { added } = result.data;
      setMessage(
        added === 0
          ? "No new episodes."
          : `Added ${added} new ${added === 1 ? "release" : "releases"}.`
      );
      router.refresh();
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
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing || !hasFilter}
          >
            {refreshing ? "Checking…" : "Refresh"}
          </Button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {hasFilter
            ? "No releases found for this feed yet."
            : "Save a Nyaa feed to build the episode list."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
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
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border bg-background/30 text-foreground",
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
                    <Button
                      variant={watched ? "secondary" : "outline"}
                      size="sm"
                      disabled={saving}
                      className={watched ? "text-accent" : undefined}
                      // Marking episode N watched means progress is at least N.
                      onClick={() =>
                        setProgress(
                          watched ? ep.episodeNumber! - 1 : ep.episodeNumber!
                        )
                      }
                    >
                      {watched ? "Watched" : "Mark watched"}
                    </Button>
                  ) : null}

                  {/* A plain anchor so the OS hands magnets to the user's torrent
                    client, exactly as plan.md asks. */}
                  <a
                    href={ep.magnetUri}
                    className={buttonVariants({ size: "sm" })}
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

"use client";

import { useEffect, useState } from "react";

/** Coarse on purpose: "2d 4h" reads better than a ticking clock for a weekly show. */
function formatGap(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${Math.max(minutes, 1)}m`;
}

/** Just the largest unit — a grid of covers has no room for "2d 4h". */
function formatGapShort(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.max(minutes, 1)}m`;
}

/**
 * Shared by every countdown: the server cannot render a duration, because
 * whatever it computes is already stale by the time the page is read. So the
 * value starts null and is filled in on mount, then refreshed each minute.
 */
function useNow() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Reading the clock on mount is the whole point of this hook; see above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return now;
}

/**
 * The library-card form: a chip on the cover art. Absolutely positioned so
 * appearing after mount cannot shift the grid.
 */
export function AiringBadge({
  episodeNumber,
  airingAt,
}: {
  episodeNumber: number;
  airingAt: string;
}) {
  const now = useNow();
  if (now === null) return null;

  const target = new Date(airingAt).getTime();
  const upcoming = now < target;

  return (
    <span
      className={[
        // Clears the progress bar that runs along the bottom edge of the card.
        "absolute bottom-2.5 left-2 rounded-full px-2 py-0.5",
        "text-[10px] font-semibold tabular-nums backdrop-blur-md",
        upcoming
          ? "bg-ink/70 text-cream ring-1 ring-inset ring-white/10"
          : "bg-anilist text-ink",
      ].join(" ")}
    >
      EP {episodeNumber}
      {upcoming ? ` · ${formatGapShort(target - now)}` : " out"}
    </span>
  );
}

export function AiringCountdown({
  episodeNumber,
  airingAt,
  polling,
}: {
  episodeNumber: number;
  /** ISO string — a Date crossing the server/client boundary is not worth it. */
  airingAt: string;
  /** Whether a Nyaa feed is saved, and so whether anything is actually looking. */
  polling: boolean;
}) {
  const target = new Date(airingAt).getTime();
  const now = useNow();

  const label =
    now === null
      ? null
      : now < target
        ? `airs in ${formatGap(target - now)}`
        : `aired ${formatGap(now - target)} ago${polling ? " — checking for a release" : ""}`;

  return (
    <p className="mt-2 text-xs text-muted">
      <span className="font-medium text-cream">Episode {episodeNumber}</span>
      {label ? ` ${label}` : null}
    </p>
  );
}

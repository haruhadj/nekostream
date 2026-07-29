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

  // Rendered on the server too, so start from null and fill in after mount:
  // any "in 2d 4h" computed during SSR is stale by the time it is read.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

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

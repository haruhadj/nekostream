/**
 * The clock, ported from the web's `airing-countdown.tsx`.
 *
 * The web version starts at null and fills in on mount to avoid a hydration
 * mismatch; there is no server render here, so it can start with a real value
 * and callers never handle a null. What carries over is the minute tick: an
 * airing countdown that never updates is worse than no countdown, and a
 * per-second one would re-render the whole schedule 60 times a minute for a
 * value measured in hours.
 */

import { useEffect, useState } from "react";

const MINUTE_MS = 60_000;

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(id);
  }, []);

  return now;
}

/**
 * Coarse on purpose: "2d 4h" reads better than a ticking clock for a weekly
 * show. `short` keeps only the largest unit, for a badge over cover art.
 */
export function formatGap(ms: number, { short = false } = {}): string {
  const minutes = Math.floor(ms / MINUTE_MS);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return short ? `${days}d` : `${days}d ${hours % 24}h`;
  if (hours > 0) return short ? `${hours}h` : `${hours}h ${minutes % 60}m`;
  return `${Math.max(minutes, 1)}m`;
}

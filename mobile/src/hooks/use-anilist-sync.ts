/**
 * Pulls the AniList lists into the *device* library, ported from the web's
 * `AniListSync` and rewired off `POST /api/library/sync`.
 *
 * The library renders from the device's own copy first — this never blocks it,
 * and a failure leaves what is already on screen intact. The five-minute
 * throttle that used to live on the server now lives in `sync/import.ts`,
 * which is what still makes it safe to fire on launch and on every
 * pull-to-refresh with no client-side guard.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { importAniListLibrary } from "@/sync/import";

export type AniListSyncState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "added"; count: number }
  | { kind: "failed"; message: string; needsAuth: boolean };

export function useAniListSync() {
  const [state, setState] = useState<AniListSyncState>({ kind: "idle" });

  // An import can outlive the screen that started it; resolving into an
  // unmounted component would warn and set state nothing reads.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Resolves to true when new titles landed, so the caller knows to reload. */
  const run = useCallback(async ({ force = false } = {}): Promise<boolean> => {
    setState({ kind: "running" });

    const result = await importAniListLibrary({ force });

    if (!alive.current) return false;

    if (!result.ok) {
      setState({
        kind: "failed",
        message: result.error,
        // No AniList token means retrying cannot help — the message points at
        // where it gets reconnected.
        needsAuth: result.needsAuth,
      });
      return false;
    }

    setState(
      result.added > 0 ? { kind: "added", count: result.added } : { kind: "idle" }
    );
    return result.added > 0;
  }, []);

  return { state, run };
}

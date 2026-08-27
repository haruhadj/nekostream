/**
 * Pulls the user's AniList lists into the server's library, ported from the
 * web's `AniListSync`.
 *
 * The library renders from the server's own copy first — this never blocks it,
 * and a failure leaves what is already on screen intact. The server throttles
 * repeat calls to one every five minutes, which is what makes it safe to fire
 * on launch and on every pull-to-refresh without a client-side guard.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { apiSend } from "@/api/client";
import type { SyncResponse } from "@/api/types";

export type AniListSyncState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "added"; count: number }
  | { kind: "failed"; message: string; needsAuth: boolean };

export function useAniListSync() {
  const [state, setState] = useState<AniListSyncState>({ kind: "idle" });

  // An AniList import can outlive the screen that started it; resolving into
  // an unmounted component would warn and set state nothing reads.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Resolves to true when new titles landed, so the caller knows to reload. */
  const run = useCallback(async (): Promise<boolean> => {
    setState({ kind: "running" });

    const result = await apiSend<SyncResponse>(
      "/api/library/sync",
      "POST",
      undefined,
      { fallbackError: "Could not reach AniList." }
    );

    if (!alive.current) return false;

    if (!result.ok) {
      setState({
        kind: "failed",
        message: result.error,
        // A 401 means the AniList token is gone or expired — retrying cannot
        // fix that, so the message points at where it gets reconnected.
        needsAuth: result.status === 401,
      });
      return false;
    }

    const { added } = result.data;
    setState(added > 0 ? { kind: "added", count: added } : { kind: "idle" });
    return added > 0;
  }, []);

  return { state, run };
}

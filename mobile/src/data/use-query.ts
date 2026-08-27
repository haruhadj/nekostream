/**
 * One async read, run when the screen first appears and re-run whenever it
 * comes back into focus.
 *
 * The direct replacement for `api/use-resource.ts`, and the same contract: the
 * focus refetch is this app's `router.refresh()`. Adding a title on Search has
 * to show up on Library, and ticking progress has to show up on Schedule,
 * without either screen knowing the other exists. It stays deliberately
 * silent — only a pull-to-refresh shows a spinner.
 *
 * What changed is only what it reads: a `load()` the screen supplies (a device
 * query, or an AniList request) instead of an HTTP path. Everything the old
 * hook got right about lifecycles is kept, because it was right for reasons
 * that have nothing to do with where the data came from.
 */

import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

export type Resource<T> = {
  data: T | null;
  error: string | null;
  /** True until the first read lands — the full-screen spinner. */
  loading: boolean;
  /** True only during a pull-to-refresh — the pull control's own spinner. */
  refreshing: boolean;
  /** Pull-to-refresh. Awaitable so a screen can run its own work first. */
  refresh: () => Promise<void>;
  /** Re-read with no visible state change, for work the user didn't ask for. */
  reload: () => Promise<void>;
  /** Swap the cached copy without a read, for optimistic updates. */
  setData: (next: T) => void;
};

/**
 * `load` must be stable — wrap it in `useCallback` — because it is what drives
 * the focus effect.
 */
export function useQuery<T>(
  load: () => Promise<T>,
  fallbackError: string
): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // A screen can be unfocused (or unmounted) while a read is in flight;
  // resolving into a dead component would warn and, worse, overwrite whatever
  // the next focus already loaded.
  const alive = useRef(true);

  const run = useCallback(async () => {
    try {
      const next = await load();
      if (!alive.current) return;
      setData(next);
      setError(null);
    } catch (thrown) {
      if (!alive.current) return;
      // The stale copy stays on screen: a failed background refetch should not
      // blank out a library the user is looking at.
      setError(thrown instanceof Error ? thrown.message : fallbackError);
    }
    if (alive.current) setLoading(false);
  }, [load, fallbackError]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run();
    if (alive.current) setRefreshing(false);
  }, [run]);

  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      void run();
      return () => {
        alive.current = false;
      };
    }, [run])
  );

  return { data, error, loading, refreshing, refresh, reload: run, setData };
}

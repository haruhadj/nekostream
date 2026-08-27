/**
 * One GET endpoint, loaded when the screen first appears and re-read whenever
 * it comes back into focus.
 *
 * The focus refetch is this app's answer to the web's `router.refresh()`:
 * adding a title on the Search tab has to show up on Library, and ticking
 * progress (Phase 5) has to show up on Schedule, without either screen
 * knowing the other exists. It is deliberately silent — only a pull-to-refresh
 * shows a spinner, because a refetch the user did not ask for should not make
 * the screen look busy.
 */

import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { apiRequest } from "./client";

export type ApiResource<T> = {
  data: T | null;
  error: string | null;
  /** True until the first response lands — the full-screen spinner. */
  loading: boolean;
  /** True only during a pull-to-refresh — the pull control's own spinner. */
  refreshing: boolean;
  /** Pull-to-refresh. Awaitable so a screen can run its own work first. */
  refresh: () => Promise<void>;
  /** Re-read with no visible state change, for work the user didn't ask for. */
  reload: () => Promise<void>;
  /** Swap the cached copy without a round trip, for optimistic updates. */
  setData: (next: T) => void;
};

export function useApiResource<T>(
  path: string,
  fallbackError: string
): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // A screen can be unfocused (or unmounted) while its request is in flight;
  // resolving into a dead component would warn and, worse, overwrite whatever
  // the next focus already loaded.
  const alive = useRef(true);

  const load = useCallback(async () => {
    const result = await apiRequest<T>(path, { fallbackError });
    if (!alive.current) return;

    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      // The stale copy stays on screen: a failed background refetch should not
      // blank out a library the user is looking at.
      setError(result.error);
    }
    setLoading(false);
  }, [path, fallbackError]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (alive.current) setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      void load();
      return () => {
        alive.current = false;
      };
    }, [load])
  );

  return { data, error, loading, refreshing, refresh, reload: load, setData };
}

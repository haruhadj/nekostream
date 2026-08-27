/**
 * The library's sort order, remembered per device.
 *
 * Stored under `nekostream:library-sort` — deliberately the same key the web
 * grid writes to `localStorage` (`library-grid.tsx`). The two stores are
 * separate, so this does not sync a phone with a browser; matching the key
 * keeps one name for one preference, so a future sync has nothing to
 * reconcile and a reader of either client finds the same string.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { DEFAULT_SORT, isSortKey, type SortKey } from "@shared/library/sort";

const STORAGE_KEY = "nekostream:library-sort";

export function useSortPreference(): [SortKey, (next: SortKey) => void] {
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);

  // AsyncStorage is async, so the grid paints in DEFAULT_SORT and reorders
  // once if a stored preference differs — the same trade the web makes.
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!cancelled && isSortKey(stored)) setSort(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback((next: SortKey) => {
    setSort(next);
    // A failed write costs the preference on next launch, nothing more — the
    // sort is already applied in memory.
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  return [sort, choose];
}

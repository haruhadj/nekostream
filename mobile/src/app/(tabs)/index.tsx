import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  parseLibraryEntry,
  type LibraryEntry,
  type LibraryResponse,
} from "@/api/types";
import { useApiResource } from "@/api/use-resource";
import { FilterChips } from "@/components/filter-chips";
import { LibraryCard } from "@/components/library-card";
import { useAniListSync } from "@/hooks/use-anilist-sync";
import { useNow } from "@/hooks/use-now";
import { useSortPreference } from "@/hooks/use-sort-preference";
import { theme } from "@/theme";
import { GRID_COLUMNS, GRID_GAP } from "@/ui/anime-grid";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { OptionSheet } from "@/ui/option-sheet";
import {
  EmptyState,
  Screen,
  ScreenLoading,
  ScreenTitle,
  SCREEN_PADDING,
} from "@/ui/screen";

import { applyFilter, FILTERS, type LibraryFilter } from "@shared/library/filters";
import { SORTS, sortEntries } from "@shared/library/sort";

/**
 * The library tab — the web's `/` page and its `LibraryGrid` folded into one
 * screen. The web splits them because the filter counts need the server's full
 * row set while sorting has to happen on the client; here everything is
 * client-side already, so a second component would only be prop-drilling.
 *
 * Filters, sorting and the day grouping all come from `@shared/*` — the same
 * modules the web renders from, which is the entire point of the Metro
 * `watchFolders` setup in Phase 2.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const now = useNow();

  const { data, loading, error, refreshing, refresh, reload } =
    useApiResource<LibraryResponse>(
      "/api/library",
      "Could not load your library."
    );

  const { state: syncState, run: runSync } = useAniListSync();
  const [syncing, setSyncing] = useState(false);

  const [sort, chooseSort] = useSortPreference();
  const [sortOpen, setSortOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(FILTERS[0].key);
  const [query, setQuery] = useState("");

  const entries = useMemo<LibraryEntry[]>(
    () => data?.entries.map(parseLibraryEntry) ?? [],
    [data]
  );

  const active =
    FILTERS.find((filter) => filter.key === activeKey) ?? FILTERS[0];

  // From the full set so every chip can show its size — the library is local
  // and small enough that filtering in memory beats six more requests.
  const countFor = useCallback(
    (filter: LibraryFilter) => applyFilter(entries, filter).length,
    [entries]
  );

  const visible = useMemo(() => {
    const sorted = sortEntries(applyFilter(entries, active), sort);
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sorted;

    return sorted.filter((entry) =>
      [entry.titleRomaji, entry.titleEnglish]
        .filter((title): title is string => Boolean(title))
        .some((title) => title.toLowerCase().includes(trimmed))
    );
  }, [entries, active, sort, query]);

  /**
   * Import once per launch, the way the web fires `AniListSync` on every
   * library visit. Doing it on every tab focus instead would be pointless: the
   * server throttles to one import per five minutes, and pull-to-refresh is
   * the deliberate way to ask again.
   */
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      // `reload`, not `refresh`: nobody pulled, so nothing should spin.
      if (await runSync()) await reload();
    })();
  }, [runSync, reload]);

  const onRefresh = useCallback(async () => {
    setSyncing(true);
    await runSync();
    setSyncing(false);
    await refresh();
  }, [runSync, refresh]);

  if (loading) {
    return (
      <Screen>
        <ScreenLoading />
      </Screen>
    );
  }

  const sortLabel =
    SORTS.find((option) => option.key === sort)?.label ?? SORTS[0].label;

  return (
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={(entry) => entry.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <LibraryCard entry={item} now={now} />}
        refreshControl={
          <RefreshControl
            refreshing={syncing || refreshing}
            onRefresh={onRefresh}
            tintColor={theme.color.muted}
            colors={[theme.color.accent]}
            progressBackgroundColor={theme.color.surface}
          />
        }
        ListHeaderComponent={
          <View>
            <ScreenTitle
              title="Library"
              trailing={
                <Text style={styles.count}>
                  {visible.length} {visible.length === 1 ? "title" : "titles"}
                </Text>
              }
            />

            <SyncNotice state={syncState} error={error} />

            {entries.length > 0 ? (
              <>
                <FilterChips
                  filters={FILTERS}
                  countFor={countFor}
                  active={active}
                  onChange={(filter) => setActiveKey(filter.key)}
                />

                <View style={styles.controls}>
                  <Input
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Filter your library"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    style={styles.search}
                    accessibilityLabel="Filter your library"
                  />
                  <Pressable
                    onPress={() => setSortOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Sort library, currently ${sortLabel}`}
                    style={({ pressed }) => [
                      styles.sortButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.sortLabel} numberOfLines={1}>
                      {sortLabel}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <LibraryEmpty
            importing={syncState.kind === "running"}
            hasEntries={entries.length > 0}
            filterLabel={active.label}
            query={query.trim()}
            onSearch={() => router.push("/search")}
          />
        }
      />

      <OptionSheet
        visible={sortOpen}
        title="Sort"
        options={SORTS}
        selected={sort}
        onSelect={chooseSort}
        onClose={() => setSortOpen(false)}
      />
    </Screen>
  );
}

/**
 * The import's own status line, plus any error from loading the library
 * itself. Both are advisory: the grid below keeps whatever it already had.
 */
function SyncNotice({
  state,
  error,
}: {
  state: ReturnType<typeof useAniListSync>["state"];
  error: string | null;
}) {
  if (error) return <Text style={styles.noticeError}>{error}</Text>;

  switch (state.kind) {
    case "idle":
      return null;
    case "running":
      return <Text style={styles.notice}>Bringing in your AniList list…</Text>;
    case "added":
      return (
        <Text style={styles.notice}>
          Added {state.count} {state.count === 1 ? "title" : "titles"} from
          AniList.
        </Text>
      );
    case "failed":
      return (
        <Text style={styles.noticeError}>
          {state.message}
          {state.needsAuth ? " Reconnect AniList in Settings." : ""}
        </Text>
      );
  }
}

function LibraryEmpty({
  importing,
  hasEntries,
  filterLabel,
  query,
  onSearch,
}: {
  importing: boolean;
  hasEntries: boolean;
  filterLabel: string;
  query: string;
  onSearch: () => void;
}) {
  if (query) return <EmptyState message={`No titles match “${query}”.`} />;
  if (importing) return <EmptyState message="Bringing in your AniList list…" />;
  if (hasEntries) {
    return <EmptyState message={`Nothing in ${filterLabel.toLowerCase()}.`} />;
  }

  return (
    <EmptyState message="Nothing here yet. Find an anime and add it to start tracking episodes.">
      <Button label="Search anime" onPress={onSearch} />
    </EmptyState>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 32, gap: 20 },
  column: { gap: GRID_GAP },
  count: { color: theme.color.muted, fontSize: 13 },
  notice: { marginTop: 12, color: theme.color.muted, fontSize: 12 },
  noticeError: { marginTop: 12, color: theme.color.danger, fontSize: 12 },
  controls: {
    marginTop: 12,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  search: { flex: 1 },
  sortButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    maxWidth: 150,
  },
  sortLabel: { color: theme.color.foreground, fontSize: 12, fontWeight: "600" },
  pressed: { opacity: 0.75 },
});

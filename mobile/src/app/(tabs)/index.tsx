import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useQuery } from "@/data/use-query";
import { listEntries, type LibraryEntryRow } from "@/db/library";
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
 * How many titles to add per scroll. Whole rows, so a page never ends on a
 * ragged half-row, and enough that a fast flick does not outrun it.
 */
const PAGE_SIZE = GRID_COLUMNS * 8;

/**
 * The library tab — the web's `/` page and its `LibraryGrid` folded into one
 * screen. The web splits them because the filter counts need the server's full
 * row set while sorting has to happen on the client; here everything is
 * client-side already, so a second component would only be prop-drilling.
 *
 * Reads the device database directly. There is no parse step any more: Drizzle
 * hands back real `Date` objects, which is exactly what `@shared/library/sort`
 * wants — the JSON round trip `api/types.ts` existed to undo is simply gone.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const now = useNow();

  const { data, loading, error, refreshing, refresh, reload } = useQuery(
    listEntries,
    "Could not read your library."
  );

  const { state: syncState, run: runSync } = useAniListSync();
  const [syncing, setSyncing] = useState(false);

  const [sort, chooseSort] = useSortPreference();
  const [sortOpen, setSortOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(FILTERS[0].key);
  const [query, setQuery] = useState("");

  /**
   * How far the list has been scrolled, tagged with what it was scrolled
   * through. Changing filter, sort or search makes the old window
   * meaningless — a filter holding twelve titles should not start out
   * rendering a window sized for 854 — so the tag resets it during render
   * rather than in an effect, which would waste a pass drawing the old one.
   */
  const [pageWindow, setPageWindow] = useState({ key: "", limit: PAGE_SIZE });

  const entries = useMemo<LibraryEntryRow[]>(() => data ?? [], [data]);

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

  // What the list is currently showing. When this changes the stored window no
  // longer describes anything, so the limit falls back to one page — computed
  // here rather than reset in an effect, which would render the stale one once.
  const listKey = `${activeKey}:${sort}:${query.trim()}`;
  const limit = pageWindow.key === listKey ? pageWindow.limit : PAGE_SIZE;

  /**
   * Only the first `limit` titles are handed to the list.
   *
   * FlatList virtualises what it *draws*, but it still measures and keys
   * every item it is given, and renders `initialNumToRender` of them before
   * the first frame. With 854 entries that cost is paid on every launch,
   * every filter tab and every keystroke in the search box — for rows nobody
   * has scrolled to.
   *
   * Filtering and sorting deliberately still run over the whole library: the
   * chip counts are of everything, and sorting a page would reshuffle it as
   * more loaded. Slicing afterwards keeps both correct.
   */
  const page = useMemo(() => visible.slice(0, limit), [visible, limit]);
  const hasMore = limit < visible.length;

  const loadMore = useCallback(() => {
    if (hasMore) setPageWindow({ key: listKey, limit: limit + PAGE_SIZE });
  }, [hasMore, listKey, limit]);

  /**
   * Import once per launch, the way the web fires `AniListSync` on every
   * library visit. Doing it on every tab focus instead would be pointless:
   * `sync/import.ts` throttles to one import per five minutes, and
   * pull-to-refresh is the deliberate way to ask again.
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
    // A deliberate pull asks AniList again rather than waiting out the
    // five-minute throttle — the phone's equivalent of the web's `force=1`.
    await runSync({ force: true });
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
        data={page}
        keyExtractor={(entry) => entry.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <LibraryCard entry={item} now={now} />}
        // Half a screen of runway: far enough ahead that the next page is
        // ready before a spinner would be seen, close enough that a slow
        // scroll does not quietly load the whole library anyway.
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={PAGE_SIZE}
        windowSize={5}
        removeClippedSubviews
        ListFooterComponent={
          hasMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={theme.color.muted} />
            </View>
          ) : null
        }
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
  footer: { paddingVertical: 20 },
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { searchMedia, trendingMedia } from "@shared/anilist/queries";
import type { AniListMedia } from "@shared/anilist/queries";

import { useQuery } from "@/data/use-query";
import { addEntry, libraryMediaIds } from "@/db/library";
import {
  SearchResultCard,
  type AddState,
} from "@/components/search-result-card";
import { theme } from "@/theme";
import { GRID_COLUMNS, GRID_GAP } from "@/ui/anime-grid";
import { Input } from "@/ui/input";
import {
  EmptyState,
  Screen,
  ScreenTitle,
  SCREEN_PADDING,
} from "@/ui/screen";

/** Long enough that typing a title doesn't fire a request per keystroke. */
const DEBOUNCE_MS = 350;

/**
 * The search tab — the web's `/search` page, now talking to AniList itself
 * through the shared `@shared/anilist/queries`. An empty query shows AniList's
 * trending list, so this is never a blank screen. Neither call needs a token:
 * search and metadata are public, which is why this tab works even when the
 * AniList token has expired.
 *
 * Adding a title writes one row to the device database and needs no hand-off
 * to the Library tab: that screen re-reads on focus.
 */
export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [media, setMedia] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addStates, setAddStates] = useState<Record<number, AddState>>({});
  const [justAdded, setJustAdded] = useState<ReadonlySet<number>>(new Set());

  // Which AniList ids the library already holds, so results show the right
  // state. Re-read on focus, which also clears `justAdded`'s job.
  const { data: ids } = useQuery(
    libraryMediaIds,
    "Could not read your library."
  );

  const libraryIds = useMemo(() => new Set(ids ?? []), [ids]);

  const isInLibrary = useCallback(
    (id: number) => libraryIds.has(id) || justAdded.has(id),
    [libraryIds, justAdded]
  );

  // Only the newest search may write results: a slow request for "fu" must not
  // land on top of a fast one for "fullmetal".
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    // Everything happens on the far side of the debounce, including the
    // "Searching…" flag — a request that hasn't been made yet isn't in
    // flight, and flipping state in the effect body itself would cascade a
    // render on every keystroke.
    const timer = setTimeout(() => {
      const id = ++requestId.current;
      setSearching(true);

      void (async () => {
        try {
          // Empty query means "show me something" — the same split the web's
          // /api/anilist/search route made server-side.
          const page = trimmed
            ? await searchMedia(trimmed)
            : await trendingMedia();

          if (id !== requestId.current) return;
          setMedia(page.media);
          setError(null);
        } catch (thrown) {
          if (id !== requestId.current) return;
          setError(thrown instanceof Error ? thrown.message : "Search failed.");
        }

        setSearching(false);
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const add = useCallback(async (item: AniListMedia) => {
    setAddStates((states) => ({ ...states, [item.id]: "adding" }));

    try {
      await addEntry({
        anilistMediaId: item.id,
        malMediaId: item.idMal,
        titleRomaji: item.title.romaji,
        titleEnglish: item.title.english,
        coverImageUrl: item.coverImage?.large ?? null,
        totalEpisodes: item.episodes,
      });
    } catch (thrown) {
      // Back to idle, not stuck mid-add — the card stays retryable.
      setAddStates((states) => ({ ...states, [item.id]: "idle" }));
      setError(
        thrown instanceof Error ? thrown.message : "Could not add that title."
      );
      return;
    }

    setJustAdded((added) => new Set(added).add(item.id));
    setAddStates((states) => ({ ...states, [item.id]: "added" }));
  }, []);

  const status = error
    ? error
    : searching
      ? "Searching…"
      : query.trim()
        ? `${media.length} results`
        : "Trending now";

  return (
    <Screen>
      <FlatList
        data={media}
        keyExtractor={(item) => String(item.id)}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <SearchResultCard
            media={item}
            inLibrary={isInLibrary(item.id)}
            addState={addStates[item.id] ?? "idle"}
            onAdd={() => void add(item)}
          />
        )}
        ListHeaderComponent={
          <View>
            <ScreenTitle
              title="Search"
              subtitle="Results come from AniList. Adding a title saves it to this device."
            />

            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search anime on AniList"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
              style={styles.search}
              accessibilityLabel="Search anime on AniList"
            />

            <Text
              style={[styles.status, error ? styles.statusError : null]}
              accessibilityLiveRegion="polite"
            >
              {status}
            </Text>
          </View>
        }
        ListEmptyComponent={
          searching ? null : (
            <EmptyState message="No anime matched that search." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 32, gap: 20 },
  column: { gap: GRID_GAP },
  search: { marginTop: 20 },
  status: { marginTop: 12, color: theme.color.muted, fontSize: 12 },
  statusError: { color: theme.color.danger },
});

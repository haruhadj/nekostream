import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { apiRequest, apiSend } from "@/api/client";
import type {
  AniListMedia,
  LibraryResponse,
  SearchResponse,
} from "@/api/types";
import { useApiResource } from "@/api/use-resource";
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
 * The search tab — the web's `/search` page. An empty query returns AniList's
 * trending list from the server, so this is never a blank screen.
 *
 * Adding a title needs no explicit hand-off to the Library tab: that screen
 * re-reads `/api/library` whenever it comes back into focus.
 */
export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [media, setMedia] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addStates, setAddStates] = useState<Record<number, AddState>>({});
  const [justAdded, setJustAdded] = useState<ReadonlySet<number>>(new Set());

  // Which AniList ids the library already holds, so results show the right
  // state. Refetched on focus, which also clears `justAdded`'s job.
  const { data: library } = useApiResource<LibraryResponse>(
    "/api/library",
    "Could not load your library."
  );

  const libraryIds = useMemo(
    () => new Set(library?.entries.map((entry) => entry.anilistMediaId) ?? []),
    [library]
  );

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
        const result = await apiRequest<SearchResponse>(
          `/api/anilist/search?q=${encodeURIComponent(trimmed)}`,
          { fallbackError: "Search failed." }
        );

        if (id !== requestId.current) return;

        if (result.ok) {
          setMedia(result.data.media ?? []);
          setError(null);
        } else {
          setError(result.error);
        }
        setSearching(false);
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const add = useCallback(async (item: AniListMedia) => {
    setAddStates((states) => ({ ...states, [item.id]: "adding" }));

    const result = await apiSend(
      "/api/library",
      "POST",
      {
        anilistMediaId: item.id,
        malMediaId: item.idMal,
        titleRomaji: item.title.romaji,
        titleEnglish: item.title.english,
        coverImageUrl: item.coverImage?.large ?? null,
        totalEpisodes: item.episodes,
      },
      { fallbackError: "Could not add that title." }
    );

    if (!result.ok) {
      // Back to idle, not stuck mid-add — the card stays retryable.
      setAddStates((states) => ({ ...states, [item.id]: "idle" }));
      setError(result.error);
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
              subtitle="Results come from AniList. Adding a title saves it to your server."
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

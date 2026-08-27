/**
 * One poster in the library grid, ported from the web's `LibraryGrid` card.
 *
 * Pressable as of Phase 3, when `/anime/[id]` — and with it somewhere to tick
 * progress — finally exists.
 */

import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AiringBadge } from "@/components/airing-badge";
import type { LibraryEntryRow } from "@/db/library";
import { AnimePoster, AnimeTitle, GRID_ITEM_MAX_WIDTH, PosterScrim } from "@/ui/anime-grid";
import { theme } from "@/theme";

export function LibraryCard({
  entry,
  now,
}: {
  entry: LibraryEntryRow;
  /** One clock for the whole grid — see `useNow`. */
  now: number;
}) {
  // Only a known total gives a meaningful bar; ongoing shows with an unknown
  // length would otherwise render a fake full one.
  const ratio =
    entry.totalEpisodes && entry.totalEpisodes > 0
      ? Math.min(entry.progress / entry.totalEpisodes, 1)
      : null;

  return (
    <Link href={`/anime/${entry.id}`} asChild>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={entry.titleEnglish ?? entry.titleRomaji}
      >
        <AnimePoster coverImageUrl={entry.coverImageUrl}>
          <PosterScrim />

          {entry.nextAiringAt && entry.nextAiringEpisode ? (
            <AiringBadge
              episodeNumber={entry.nextAiringEpisode}
              airingAt={entry.nextAiringAt}
              now={now}
            />
          ) : null}

          {ratio !== null && ratio > 0 ? (
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${ratio * 100}%` }]}
              />
            </View>
          ) : null}
        </AnimePoster>

        <AnimeTitle>{entry.titleEnglish ?? entry.titleRomaji}</AnimeTitle>

        <Text style={styles.progressLabel}>
          {entry.progress}
          {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""} watched
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  // maxWidth keeps a lone card in a half-filled final row at column width
  // instead of letting flex stretch it across the whole list.
  card: { flex: 1, maxWidth: GRID_ITEM_MAX_WIDTH },
  pressed: { opacity: 0.75 },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "rgba(9, 9, 11, 0.5)",
  },
  progressFill: { height: "100%", backgroundColor: theme.color.accent },
  progressLabel: { marginTop: 4, color: theme.color.muted, fontSize: 11 },
});

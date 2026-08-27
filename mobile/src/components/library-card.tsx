/**
 * One poster in the library grid, ported from the web's `LibraryGrid` card.
 *
 * Not pressable yet: the detail screen it would open is Phase 5. Making it
 * look tappable before there is anywhere to go would be the worse of the two
 * unfinished states.
 */

import { StyleSheet, Text, View } from "react-native";

import { AiringBadge } from "@/components/airing-badge";
import type { LibraryEntry } from "@/api/types";
import { AnimePoster, AnimeTitle, PosterScrim } from "@/ui/anime-grid";
import { theme } from "@/theme";

export function LibraryCard({
  entry,
  now,
}: {
  entry: LibraryEntry;
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
    <View style={styles.card}>
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
            <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
          </View>
        ) : null}
      </AnimePoster>

      <AnimeTitle>{entry.titleEnglish ?? entry.titleRomaji}</AnimeTitle>

      <Text style={styles.progressLabel}>
        {entry.progress}
        {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""} watched
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // maxWidth keeps a lone card in a half-filled final row at column width
  // instead of letting flex stretch it across the whole list.
  card: { flex: 1, maxWidth: "50%" },
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

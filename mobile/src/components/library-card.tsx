/**
 * One poster in the library grid, ported from the web's `LibraryGrid` card.
 *
 * Pressable as of Phase 3, when `/anime/[id]` — and with it somewhere to tick
 * progress — finally exists.
 *
 * Navigates with `router.push` rather than `<Link asChild>`, and that is
 * load-bearing rather than taste: under `asChild` this card lost its own
 * `flex: 1, maxWidth` entirely, so every cover filled the whole row and the
 * second column overflowed off-screen.
 *
 * The cause is expo-router's Slot shim (`expo-router/build/ui/Slot.js`), which
 * destructures `style` off the Link's props, runs it through
 * `StyleSheet.flatten`, and passes the result to the child. A Pressable's style
 * is a *function* of press state, which cannot survive that merge — the shim
 * even throws in development when a child's style is an array. Putting the
 * styles on the Link instead would work, but then press feedback has nowhere
 * to live; `router.push` keeps both.
 */

import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AiringBadge } from "@/components/airing-badge";
import type { LibraryEntryRow } from "@/db/library";
import { theme } from "@/theme";
import {
  AnimePoster,
  AnimeTitle,
  GRID_ITEM_MAX_WIDTH,
  PosterScrim,
} from "@/ui/anime-grid";

export function LibraryCard({
  entry,
  now,
}: {
  entry: LibraryEntryRow;
  /** One clock for the whole grid — see `useNow`. */
  now: number;
}) {
  const router = useRouter();

  // Only a known total gives a meaningful bar; ongoing shows with an unknown
  // length would otherwise render a fake full one.
  const ratio =
    entry.totalEpisodes && entry.totalEpisodes > 0
      ? Math.min(entry.progress / entry.totalEpisodes, 1)
      : null;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/anime/[id]", params: { id: entry.id } })
      }
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
            <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
          </View>
        ) : null}
      </AnimePoster>

      <AnimeTitle>{entry.titleEnglish ?? entry.titleRomaji}</AnimeTitle>

      <Text style={styles.progressLabel}>
        {entry.progress}
        {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""} watched
      </Text>
    </Pressable>
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

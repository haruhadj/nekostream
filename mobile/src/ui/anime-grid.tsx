/**
 * The poster frame, shared by Library and Search exactly as the web's
 * `ui/anime-grid.tsx` is. The frame lives here; what gets overlaid on the art
 * — the airing badge, the progress bar, the "In library" pill — stays at the
 * call sites as children.
 *
 * The grid itself is a `FlatList numColumns={GRID_COLUMNS}` at each call site
 * rather than a wrapper component: the two screens need their own
 * `ListHeaderComponent`, refresh control and empty state, and a component that
 * forwarded all of that would just be FlatList with extra steps. The metrics
 * both lists share are exported instead.
 */

import { Image } from "expo-image";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme";

/** Two columns at phone width — a 2:3 poster three-up is too small to read. */
export const GRID_COLUMNS = 2;
export const GRID_GAP = 12;

export function AnimePoster({
  coverImageUrl,
  children,
}: {
  coverImageUrl: string | null | undefined;
  children?: ReactNode;
}) {
  return (
    <View style={styles.poster}>
      {coverImageUrl ? (
        <Image
          source={{ uri: coverImageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          // Covers are immutable per media id, so the disk copy is the right
          // default: scrolling the library twice shouldn't re-hit AniList's CDN.
          cachePolicy="disk"
          transition={150}
          accessible={false}
        />
      ) : null}

      {children}
    </View>
  );
}

export function AnimeTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.title} numberOfLines={2}>
      {children}
    </Text>
  );
}

/** Darkens the foot of the art so overlaid text stays legible. */
export function PosterScrim() {
  return <View style={styles.scrim} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  poster: {
    aspectRatio: 2 / 3,
    width: "100%",
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  title: {
    marginTop: 8,
    color: theme.color.foreground,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  // React Native has no gradients without a native dependency; a flat wash
  // over the bottom third does the same job for a one-line badge.
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "33%",
    backgroundColor: "rgba(9, 9, 11, 0.65)",
  },
});

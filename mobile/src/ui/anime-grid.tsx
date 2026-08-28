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
import { Dimensions, StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme";

export const GRID_GAP = 12;

/** The horizontal gutter both grids sit inside — SCREEN_PADDING, doubled. */
const GUTTER = 32;

/**
 * How wide a poster wants to be, in dp. Everything else follows from it.
 *
 * A fixed two columns was too big to read as a grid: on a 360dp phone that
 * is a 158dp poster — half the screen wide — so scanning an 854-title
 * library means scrolling past two covers at a time. Around 100dp reads as a
 * shelf rather than a slideshow, and is roughly what Mihon shows.
 */
const TARGET_POSTER_WIDTH = 100;

/**
 * Derived once, not per render: the app is portrait-locked (app.json), so the
 * window width does not change under it. Reading it from a hook would mean
 * changing `numColumns` at runtime, which remounts the whole FlatList.
 *
 * The clamp mirrors the web's breakpoints — two columns at the narrowest,
 * five at tablet width (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`).
 */
export const GRID_COLUMNS = Math.min(
  5,
  Math.max(
    2,
    Math.floor(
      (Dimensions.get("window").width - GUTTER + GRID_GAP) /
        (TARGET_POSTER_WIDTH + GRID_GAP)
    )
  )
);

/** What one card may occupy, so a half-filled final row keeps column width. */
export const GRID_ITEM_MAX_WIDTH = `${100 / GRID_COLUMNS}%` as const;

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
    marginTop: 6,
    color: theme.color.foreground,
    // Scales with the column count: at three-up, a 13pt title wraps to two
    // lines on almost every show and the rows go ragged.
    fontSize: GRID_COLUMNS > 2 ? 11 : 13,
    fontWeight: "600",
    lineHeight: GRID_COLUMNS > 2 ? 15 : 18,
  },
  // The web's `bg-gradient-to-t from-background/85 to-transparent`, restored:
  // the flat wash that stood in for it — React Native once had no gradient
  // without a native dependency — read as a hard black band across the foot of
  // every cover. RN 0.86 takes CSS gradients directly; `experimental_` is its
  // name for the property, not a flag to turn on.
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "33%",
    experimental_backgroundImage:
      "linear-gradient(to top, rgba(9, 9, 11, 0.85), rgba(9, 9, 11, 0))",
  },
});

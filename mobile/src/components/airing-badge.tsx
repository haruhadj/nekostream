/**
 * The chip on a library card's cover art, ported from the web's `AiringBadge`.
 * Absolutely positioned, clearing the progress bar along the bottom edge.
 */

import { StyleSheet, Text, View } from "react-native";

import { formatGap } from "@/hooks/use-now";
import { theme } from "@/theme";

export function AiringBadge({
  episodeNumber,
  airingAt,
  now,
}: {
  episodeNumber: number;
  airingAt: Date;
  /** Passed in rather than read here so one clock drives the whole grid. */
  now: number;
}) {
  const target = airingAt.getTime();
  const upcoming = now < target;

  return (
    <View style={[styles.badge, upcoming ? styles.upcoming : styles.out]}>
      <Text style={[styles.text, upcoming ? styles.textUpcoming : styles.textOut]}>
        EP {episodeNumber}
        {upcoming ? ` · ${formatGap(target - now, { short: true })}` : " out"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    left: 8,
    bottom: 10,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  // Pre-blended against the poster's own dark art, since React Native cannot
  // blur what is behind a view without a native dependency.
  upcoming: { backgroundColor: "rgba(9, 9, 11, 0.85)" },
  out: { backgroundColor: theme.color.accent },
  text: { fontSize: 10, fontWeight: "700" },
  textUpcoming: { color: theme.color.foreground },
  textOut: { color: theme.color.accentForeground },
});

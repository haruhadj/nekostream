/**
 * The library's status tabs, ported from the web library page's chip row.
 * Horizontally scrollable for the same reason it is there: seven filters never
 * fit across a 360px screen, and wrapping them into a grid eats the fold.
 *
 * Categories come from the shared `@shared/library/filters` — the same list
 * the web tabs and the Stremio catalogs read, so the three cannot drift apart.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { LibraryFilter } from "@shared/library/filters";
import { SCREEN_PADDING } from "@/ui/screen";
import { theme } from "@/theme";

export function FilterChips({
  filters,
  countFor,
  active,
  onChange,
}: {
  filters: LibraryFilter[];
  countFor: (filter: LibraryFilter) => number;
  active: LibraryFilter;
  onChange: (filter: LibraryFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Full-bleed: the row scrolls edge to edge while its chips keep the
      // screen gutter, so the first and last don't sit flush against the frame.
      style={styles.row}
      contentContainerStyle={styles.rowContent}
    >
      {filters.map((filter) => {
        const count = countFor(filter);
        // An empty status is noise — except "All", which anchors the row.
        if (count === 0 && filter.key !== "all") return null;

        const isActive = filter.key === active.key;

        return (
          <Pressable
            key={filter.key}
            onPress={() => onChange(filter)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.chip,
              isActive ? styles.chipActive : styles.chipIdle,
              pressed && styles.chipPressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                isActive ? styles.labelActive : styles.labelIdle,
              ]}
            >
              {filter.label}
            </Text>
            <View style={[styles.count, isActive && styles.countActive]}>
              <Text
                style={[
                  styles.countText,
                  isActive ? styles.labelActive : styles.labelIdle,
                ]}
              >
                {count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 16, marginHorizontal: -SCREEN_PADDING, flexGrow: 0 },
  rowContent: { paddingHorizontal: SCREEN_PADDING, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipIdle: {
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  chipActive: {
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accent,
  },
  chipPressed: { opacity: 0.75 },
  label: { fontSize: 12, fontWeight: "600" },
  labelIdle: { color: theme.color.muted },
  labelActive: { color: theme.color.accentForeground },
  count: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: theme.color.background,
  },
  countActive: { backgroundColor: "rgba(9, 9, 11, 0.25)" },
  countText: { fontSize: 10, fontWeight: "600" },
});

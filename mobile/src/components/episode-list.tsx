/**
 * The releases found through the saved feed — the port of the web's
 * `episode-list.tsx`, and the feature the whole app exists for.
 *
 * `Linking.openURL(magnetUri)` is what the web's plain `<a href>` was: the OS
 * hands the magnet to whatever torrent client the user has. Nothing here
 * downloads anything, which is the project's oldest non-goal.
 *
 * "Mark watched" writes through the same progress path as the stepper above
 * it — marking episode N watched means progress is at least N — so a tap here
 * reaches both trackers exactly like a tap there.
 */

import { useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";

import { formatBytes, formatRelative } from "@shared/format";

import type { EpisodeRow } from "@/db/nyaa";
import { theme } from "@/theme";
import { Button } from "@/ui/button";

export function EpisodeList({
  episodes,
  progress,
  lastFetchedAt,
  hasFilter,
  busy,
  onRefresh,
  onMarkWatched,
}: {
  episodes: EpisodeRow[];
  progress: number;
  lastFetchedAt: Date | null;
  hasFilter: boolean;
  /** True while a progress write is in flight, so both paths can't race. */
  busy: boolean;
  /** Re-runs the saved search. Returns a line to show, error or otherwise. */
  onRefresh: () => Promise<string>;
  onMarkWatched: (progress: number) => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      setMessage(await onRefresh());
    } finally {
      setRefreshing(false);
    }
  }

  async function openMagnet(magnetUri: string) {
    try {
      await Linking.openURL(magnetUri);
    } catch {
      // A phone with no torrent client installed has nothing to hand this to,
      // and the OS error alone ("no activity found") explains nothing.
      Alert.alert(
        "No app for magnet links",
        "Install a torrent client that handles magnet links, then try again."
      );
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.heading}>Episodes</Text>

        <View style={styles.headerRight}>
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {message ??
              (lastFetchedAt
                ? `Checked ${formatRelative(lastFetchedAt)}`
                : "Not checked yet")}
          </Text>
          <Button
            label={refreshing ? "Checking…" : "Refresh"}
            variant="outline"
            size="sm"
            busy={refreshing}
            disabled={!hasFilter}
            onPress={() => void refresh()}
          />
        </View>
      </View>

      {episodes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {hasFilter
              ? "No releases found for this feed yet."
              : "Save a Nyaa feed to build the episode list."}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {episodes.map((ep, index) => {
            const watched =
              ep.episodeNumber !== null && ep.episodeNumber <= progress;
            const episodeNumber = ep.episodeNumber;

            return (
              <View
                key={ep.id}
                style={[
                  styles.row,
                  index > 0 && styles.rowDivided,
                  watched && styles.rowWatched,
                ]}
              >
                <View style={styles.rowTop}>
                  <View
                    style={[styles.number, watched && styles.numberWatched]}
                  >
                    <Text
                      style={[
                        styles.numberText,
                        watched && styles.numberTextWatched,
                      ]}
                    >
                      {episodeNumber !== null ? episodeNumber : "—"}
                    </Text>
                  </View>

                  <View style={styles.rowText}>
                    {/* Release titles run long; two lines beats truncating
                        them to nothing. */}
                    <Text style={styles.title} numberOfLines={2}>
                      {ep.rawTitle}
                    </Text>
                    <Text style={styles.meta}>
                      {[
                        ep.releaseGroup,
                        ep.quality,
                        formatBytes(ep.sizeBytes),
                        ep.seeders !== null ? `${ep.seeders} seeders` : null,
                        formatRelative(ep.publishedAt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                </View>

                <View style={styles.rowActions}>
                  {episodeNumber !== null ? (
                    <Button
                      label={watched ? "Watched" : "Mark watched"}
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onPress={() =>
                        void onMarkWatched(
                          watched ? episodeNumber - 1 : episodeNumber
                        )
                      }
                    />
                  ) : null}

                  <Button
                    label="Magnet"
                    size="sm"
                    onPress={() => void openMagnet(ep.magnetUri)}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  header: { gap: 8 },
  heading: { color: theme.color.foreground, fontSize: 14, fontWeight: "700" },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  status: { flex: 1, color: theme.color.muted, fontSize: 12 },
  empty: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.color.border,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  list: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: "hidden",
  },
  row: { padding: 12, gap: 10, backgroundColor: theme.color.surface },
  rowDivided: { borderTopWidth: 1, borderTopColor: theme.color.border },
  rowWatched: { backgroundColor: theme.color.background },
  rowTop: { flexDirection: "row", gap: 12 },
  number: {
    height: 32,
    width: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  numberWatched: { borderColor: theme.color.accent },
  numberText: {
    color: theme.color.foreground,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  numberTextWatched: { color: theme.color.accent, fontWeight: "700" },
  rowText: { flex: 1, gap: 4 },
  title: { color: theme.color.foreground, fontSize: 13, lineHeight: 18 },
  meta: { color: theme.color.muted, fontSize: 11, lineHeight: 16 },
  rowActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});

/**
 * One show's next episode, ported from the web's `ScheduleCard`.
 *
 * The watched-against-aired gap is the whole point of the screen, so the two
 * signals it carries are kept verbatim: the two-layer `EpisodeBar`, and the
 * amber card border whenever something has aired that hasn't been watched.
 */

import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import type { ScheduleRow } from "@/db/library";
import { theme } from "@/theme";
import { Badge } from "@/ui/badge";

const TIME_FORMAT = new Intl.DateTimeFormat([], {
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Watched against aired, on one scale: the accent fill is what has been
 * watched, the amber behind it what has aired and hasn't. The gap between the
 * two ends is the backlog, readable without counting.
 */
function EpisodeBar({
  watched,
  aired,
  total,
}: {
  watched: number;
  aired: number;
  total: number;
}) {
  const width = (episodes: number) =>
    `${Math.min((episodes / total) * 100, 100)}%` as const;

  return (
    <View style={styles.barTrack}>
      <View style={[styles.barAired, { width: width(aired) }]} />
      <View style={[styles.barWatched, { width: width(watched) }]} />
    </View>
  );
}

export function ScheduleCard({
  entry,
  airingNext,
  now,
}: {
  entry: ScheduleRow;
  /** The single soonest-upcoming episode across the whole list. */
  airingNext: boolean;
  now: number;
}) {
  const hasAired = entry.airingAt.getTime() <= now;
  // A row tracks one episode at a time: `nextAiringEpisode` is upcoming until
  // its air time passes, after which it is itself the latest aired episode —
  // the poller only advances the row once AniList announces the following one.
  const latestAired = hasAired
    ? entry.nextAiringEpisode
    : entry.nextAiringEpisode - 1;
  // A tracker can sit ahead of AniList's airing data, so never report a
  // negative backlog.
  const unwatched = Math.max(latestAired - entry.progress, 0);
  // Without a known season length, scale the bar to what has aired: still a
  // true watched/aired split, just without the rest of the season for context.
  const barTotal = entry.totalEpisodes ?? latestAired;

  return (
    <View style={styles.wrapper}>
      {airingNext ? (
        <Badge label="Airing Next" variant="accent" style={styles.nextBadge} />
      ) : null}

      <View style={[styles.card, unwatched > 0 && styles.cardBehind]}>
        <View style={styles.cover}>
          {entry.coverImageUrl ? (
            <Image
              source={{ uri: entry.coverImageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="disk"
              accessible={false}
            />
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {entry.titleEnglish ?? entry.titleRomaji}
          </Text>

          {latestAired > 0 ? (
            <>
              {barTotal > 0 ? (
                <EpisodeBar
                  watched={entry.progress}
                  aired={latestAired}
                  total={barTotal}
                />
              ) : null}

              {unwatched > 0 ? (
                <Text style={styles.ledger}>
                  <Text style={styles.muted}>Ep {entry.progress} watched</Text>
                  <Text style={styles.muted}>{"   "}</Text>
                  <Text style={styles.behind}>Ep {latestAired} aired</Text>
                </Text>
              ) : (
                <Text style={[styles.ledger, styles.muted]}>
                  Caught up — Ep {latestAired} aired
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.ledger, styles.muted]}>Nothing aired yet</Text>
          )}

          <View style={styles.airRow}>
            <View style={[styles.dot, hasAired ? styles.dotAired : styles.dotUpcoming]} />
            <Text style={styles.muted}>
              {hasAired ? "Aired" : `Ep ${entry.nextAiringEpisode} airs`} at{" "}
              <Text style={styles.time}>{TIME_FORMAT.format(entry.airingAt)}</Text>
            </Text>
          </View>

          {hasAired && entry.hasFeed ? (
            <Text style={styles.polling}>Checking for a release</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative", paddingTop: 8 },
  nextBadge: { position: "absolute", top: 0, left: 12, zIndex: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  // An unwatched aired episode is the reason to open this show at all, so
  // those cards carry the signal out to their edge.
  cardBehind: { borderColor: theme.color.amberBorder },
  cover: {
    width: 40,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.background,
  },
  body: { flex: 1, minWidth: 0 },
  title: { color: theme.color.foreground, fontSize: 14, fontWeight: "600" },
  barTrack: {
    position: "relative",
    marginTop: 8,
    height: 4,
    width: "100%",
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: theme.color.border,
  },
  barAired: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.color.amberFill,
  },
  barWatched: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.color.accent,
  },
  ledger: { marginTop: 6, fontSize: 12 },
  muted: { color: theme.color.muted, fontSize: 12 },
  behind: { color: theme.color.amberText, fontSize: 12, fontWeight: "700" },
  airRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  dotAired: { backgroundColor: theme.color.accent },
  dotUpcoming: { borderWidth: 1, borderColor: theme.color.muted },
  time: { color: theme.color.foreground, fontVariant: ["tabular-nums"] },
  polling: { marginTop: 2, color: theme.color.muted, fontSize: 11 },
});

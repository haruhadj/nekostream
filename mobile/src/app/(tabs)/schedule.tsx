import { useMemo } from "react";
import { RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";

import { useQuery } from "@/data/use-query";
import { scheduleEntries, type ScheduleRow } from "@/db/library";
import { ScheduleCard } from "@/components/schedule-card";
import { useNow } from "@/hooks/use-now";
import { theme } from "@/theme";
import {
  EmptyState,
  Screen,
  ScreenLoading,
  ScreenTitle,
  SCREEN_PADDING,
} from "@/ui/screen";

import { groupByDay } from "@shared/schedule/group";

/**
 * The schedule tab — the web's `/schedule` page, now reading the device
 * database. `scheduleEntries()` is the port of `getScheduleEntries()`,
 * including its `hasFeed` left join, so the screen still needs one query
 * rather than one per row.
 *
 * The broadcast times it renders are refreshed by `sync/import.ts` when the
 * library syncs — on the server that is the poller's six-hourly job, and there
 * is no always-on process here to do it until Phase 5's background task.
 *
 * Days come from the shared `groupByDay`, in the phone's local time zone.
 */
export default function ScheduleScreen() {
  const now = useNow();

  const { data, loading, error, refreshing, refresh } = useQuery(
    scheduleEntries,
    "Could not read your schedule."
  );

  const entries = useMemo<ScheduleRow[]>(() => data ?? [], [data]);

  // `groupByDay` preserves the query's ascending order, so SectionList's
  // sections come out chronological without a second sort.
  const sections = useMemo(
    () =>
      groupByDay(entries, new Date(now)).map((group) => ({
        key: String(group.date.getTime()),
        label: group.label,
        data: group.entries,
      })),
    [entries, now]
  );

  // The single soonest-upcoming entry overall gets the "Airing Next" badge —
  // the flat list is already ascending, so the first one past `now` is it.
  const airingNextId = entries.find(
    (entry) => entry.airingAt.getTime() > now
  )?.id;

  if (loading) {
    return (
      <Screen>
        <ScreenLoading />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        renderItem={({ item }) => (
          <ScheduleCard
            entry={item}
            airingNext={item.id === airingNextId}
            now={now}
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.label}</Text>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.color.muted}
            colors={[theme.color.accent]}
            progressBackgroundColor={theme.color.surface}
          />
        }
        ListHeaderComponent={
          <View>
            <ScreenTitle
              title="Schedule"
              subtitle="The next episode for everything in your library that's still airing."
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState message="Nothing airing right now. Shows with a broadcast still ahead will show up here." />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 32 },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 4,
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  error: { marginTop: 12, color: theme.color.danger, fontSize: 12 },
});

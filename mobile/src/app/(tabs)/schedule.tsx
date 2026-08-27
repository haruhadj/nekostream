import { useMemo } from "react";
import { RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";

import {
  parseScheduleItem,
  type ScheduleItem,
  type ScheduleResponse,
} from "@/api/types";
import { useApiResource } from "@/api/use-resource";
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
 * The schedule tab — the web's `/schedule` page against
 * `GET /api/library/schedule`, which exists precisely so this client doesn't
 * have to reconstruct `hasFeed` with one request per entry (Phase 1b).
 *
 * Days come from the shared `groupByDay`, in the phone's local time zone.
 */
export default function ScheduleScreen() {
  const now = useNow();

  const { data, loading, error, refreshing, refresh } =
    useApiResource<ScheduleResponse>(
      "/api/library/schedule",
      "Could not load your schedule."
    );

  const entries = useMemo<ScheduleItem[]>(
    () => data?.entries.map(parseScheduleItem) ?? [],
    [data]
  );

  // `groupByDay` preserves the server's ascending order, so SectionList's
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

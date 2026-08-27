/**
 * One anime: what the device knows, plus what AniList says about it.
 *
 * This is where progress is ticked, which is why it exists now rather than in
 * a later phase — `sync/progress.ts` ports the dual-write rule, and a rule
 * nothing can invoke is not a ported rule.
 *
 * The Nyaa filter editor and the episode list belong on this screen too, and
 * arrive in Phase 4; the placeholder at the bottom says so rather than
 * pretending the screen is finished.
 */

import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { mediaById, type AniListMedia } from "@shared/anilist/queries";
import { anilistAnimeUrl, malAnimeUrl } from "@shared/providers";

import { AiringBadge } from "@/components/airing-badge";
import { ProgressControl } from "@/components/progress-control";
import { useQuery } from "@/data/use-query";
import { entryById } from "@/db/library";
import { useNow } from "@/hooks/use-now";
import { tickProgress, type SyncOutcome } from "@/sync/progress";
import { theme } from "@/theme";
import { Screen, ScreenLoading, SCREEN_PADDING } from "@/ui/screen";

export default function AnimeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const now = useNow();

  const load = useCallback(() => entryById(id), [id]);
  const { data: entry, loading, setData } = useQuery(load, "Not found.");

  // AniList's own copy — description, genres, score. Fetched separately
  // because none of it is worth storing per entry (see viewerLibrary's own
  // note on why the import keeps only what the library renders).
  const [media, setMedia] = useState<AniListMedia | null>(null);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;

    void (async () => {
      try {
        const found = await mediaById(entry.anilistMediaId);
        if (!cancelled) setMedia(found);
      } catch {
        // Advisory only: the screen's own data is already on it.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entry]);

  const onChange = useCallback(
    async (next: number): Promise<SyncOutcome[]> => {
      if (!entry) return [];
      const result = await tickProgress(entry, next);
      // The local write already happened; show it whatever the trackers did.
      if (result.entry) setData(result.entry);
      return result.outcomes;
    },
    [entry, setData]
  );

  if (loading) {
    return (
      <Screen>
        <ScreenLoading />
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={styles.missingText}>
            That title is not in your library.
          </Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: entry.titleEnglish ?? entry.titleRomaji }} />

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={styles.back}
        >
          <Text style={styles.link}>← Library</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.posterFrame}>
            <Image
              source={entry.coverImageUrl ? { uri: entry.coverImageUrl } : null}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="disk"
              transition={120}
            />
            {entry.nextAiringAt && entry.nextAiringEpisode ? (
              <AiringBadge
                episodeNumber={entry.nextAiringEpisode}
                airingAt={entry.nextAiringAt}
                now={now}
              />
            ) : null}
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              {entry.titleEnglish ?? entry.titleRomaji}
            </Text>
            {entry.titleEnglish && entry.titleEnglish !== entry.titleRomaji ? (
              <Text style={styles.subtitle}>{entry.titleRomaji}</Text>
            ) : null}
            <Text style={styles.meta}>
              {[
                media?.format,
                media?.seasonYear ? String(media.seasonYear) : null,
                entry.totalEpisodes ? `${entry.totalEpisodes} episodes` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>

        <ProgressControl
          progress={entry.progress}
          totalEpisodes={entry.totalEpisodes}
          onChange={onChange}
        />

        <View style={styles.trackerLinks}>
          <TrackerLink
            label="AniList"
            tint={theme.color.anilist}
            url={anilistAnimeUrl(entry.anilistMediaId)}
          />
          {entry.malMediaId ? (
            <TrackerLink
              label="MyAnimeList"
              tint={theme.color.mal}
              url={malAnimeUrl(entry.malMediaId)}
            />
          ) : null}
        </View>

        {media?.genres?.length ? (
          <Text style={styles.genres}>{media.genres.join(" · ")}</Text>
        ) : null}

        {media?.description ? (
          <Text style={styles.description}>{stripHtml(media.description)}</Text>
        ) : null}

        <View style={styles.pending}>
          <Text style={styles.pendingText}>
            Episode releases and the Nyaa search for this title arrive in the
            next phase.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function TrackerLink({
  label,
  tint,
  url,
}: {
  label: string;
  tint: string;
  url: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [
        styles.trackerLink,
        { borderColor: tint },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.trackerLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * AniList returns descriptions with `asHtml: false`, which still leaves `<br>`
 * and the odd `<i>` in the text. React Native renders neither, so they are
 * flattened rather than shown as literal markup.
 */
function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 20,
  },
  back: { alignSelf: "flex-start" },
  link: { color: theme.color.accent, fontSize: 14, fontWeight: "600" },
  header: { flexDirection: "row", gap: 16 },
  posterFrame: {
    width: 116,
    aspectRatio: 2 / 3,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: theme.color.surface,
  },
  poster: { width: "100%", height: "100%" },
  headerText: { flex: 1, gap: 6 },
  title: {
    color: theme.color.foreground,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },
  subtitle: { color: theme.color.muted, fontSize: 13, lineHeight: 18 },
  meta: { color: theme.color.muted, fontSize: 12 },
  trackerLinks: { flexDirection: "row", gap: 10 },
  trackerLink: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: theme.color.surface,
  },
  trackerLabel: { fontSize: 13, fontWeight: "600" },
  pressed: { opacity: 0.75 },
  genres: { color: theme.color.muted, fontSize: 12 },
  description: {
    color: theme.color.foreground,
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.9,
  },
  pending: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.color.border,
    padding: 18,
  },
  pendingText: {
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  missingText: { color: theme.color.muted, fontSize: 14 },
});

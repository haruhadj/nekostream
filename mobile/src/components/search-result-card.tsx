/**
 * One AniList result, ported from the web's `SearchBrowser` card.
 *
 * The web's tap-to-preview sheet is deliberately not here: it exists so a
 * title that isn't in the library still has somewhere to show its synopsis,
 * which on a phone is what the Phase 5 detail screen will be. What Phase 4
 * needs is the part that changes the library — the Add button.
 */

import { StyleSheet, Text, View } from "react-native";

import type { AniListMedia } from "@shared/anilist/queries";
import { theme } from "@/theme";
import { AnimePoster, AnimeTitle } from "@/ui/anime-grid";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";

export type AddState = "idle" | "adding" | "added";

export function SearchResultCard({
  media,
  inLibrary,
  addState,
  onAdd,
}: {
  media: AniListMedia;
  inLibrary: boolean;
  addState: AddState;
  onAdd: () => void;
}) {
  const meta = [media.format, media.seasonYear].filter(Boolean).join(" · ");

  return (
    <View style={styles.card}>
      <AnimePoster coverImageUrl={media.coverImage?.large}>
        {inLibrary ? (
          <Badge label="In library" style={styles.badge} />
        ) : null}
      </AnimePoster>

      <AnimeTitle>{media.title.english ?? media.title.romaji}</AnimeTitle>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}

      {/* Pinned to the foot of the card so a short title or a missing
          format/year can't float the button up out of the row. */}
      <View style={styles.action}>
        <Button
          label={inLibrary ? "In library" : "Add"}
          variant={inLibrary ? "outline" : "primary"}
          size="sm"
          onPress={onAdd}
          disabled={inLibrary}
          busy={addState === "adding"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, maxWidth: "50%" },
  badge: { position: "absolute", top: 8, right: 8 },
  meta: { marginTop: 2, color: theme.color.muted, fontSize: 11 },
  action: { marginTop: "auto", paddingTop: 8 },
});

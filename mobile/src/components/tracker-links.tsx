/**
 * Out to each tracker's own page for the show — the port of the web's
 * `tracker-links.tsx`, marks and all.
 *
 * The web's styling carries over directly: a brand-tinted border and fill, the
 * official mark, the tracker's name, and a small external-link affordance.
 * React Native has no `bg-[#02A9FF]/10`, but it does take 8-digit hex, so the
 * alphas are written as `…1A` (10%) and `…66` (40%) instead of pre-blended
 * constants.
 *
 * MyAnimeList is omitted when the entry has no MAL mapping — AniList simply
 * had no `idMal` for it, and there is nowhere to link to.
 */

import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { anilistAnimeUrl, malAnimeUrl, PROVIDER_LABEL } from "@shared/providers";

import { theme } from "@/theme";
import { ANILIST_MARK, MAL_MARK } from "@/ui/tracker-marks";

const BRAND = {
  anilist: { tint: "#02A9FF", fill: "#02A9FF1A", border: "#02A9FF66" },
  mal: { tint: "#5C7EDB", fill: "#5C7EDB1A", border: "#5C7EDB66" },
} as const;

export function TrackerLinks({
  anilistMediaId,
  malMediaId,
}: {
  anilistMediaId: number;
  malMediaId: number | null;
}) {
  return (
    <View style={styles.row}>
      <TrackerLink
        url={anilistAnimeUrl(anilistMediaId)}
        label={PROVIDER_LABEL.anilist}
        mark={ANILIST_MARK}
        brand={BRAND.anilist}
      />

      {malMediaId !== null ? (
        <TrackerLink
          url={malAnimeUrl(malMediaId)}
          label={PROVIDER_LABEL.mal}
          mark={MAL_MARK}
          brand={BRAND.mal}
        />
      ) : null}
    </View>
  );
}

function TrackerLink({
  url,
  label,
  mark,
  brand,
}: {
  url: string;
  label: string;
  mark: string;
  brand: { tint: string; fill: string; border: string };
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open on ${label}`}
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [
        styles.link,
        { backgroundColor: brand.fill, borderColor: brand.border },
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: mark }}
        style={styles.mark}
        contentFit="contain"
        // The mark is decorative: the label beside it already names the
        // tracker, exactly as on the web.
        accessible={false}
      />
      <Text style={styles.label}>{label}</Text>
      <Feather name="external-link" size={12} color={theme.color.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  pressed: { opacity: 0.75 },
  mark: { width: 16, height: 16 },
  label: { color: theme.color.foreground, fontSize: 13, fontWeight: "600" },
});

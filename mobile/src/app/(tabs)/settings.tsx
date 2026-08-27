import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { MAL_CONFIG_ERROR } from "@/auth/config";
import { useAuth } from "@/auth/context";
import { theme } from "@/theme";
import { Button } from "@/ui/button";
import { Screen, ScreenTitle, SCREEN_PADDING } from "@/ui/screen";

/**
 * The two tracker accounts, and the ways in and out of each.
 *
 * This replaces the server + session card: there is no server to name any
 * more, and no session — just AniList, which gates the app, and MyAnimeList,
 * which is optional and can be linked or dropped at any time. That asymmetry
 * is the same one the web app has, and it is deliberate: one tracker failing
 * never takes the other with it.
 *
 * The notification toggle and the Stremio addon are not coming here. Email
 * needs SMTP and Stremio needs an addon URL — both are the server's, and this
 * client no longer has one (see context/functionality.md).
 */
export default function SettingsScreen() {
  const { anilist, mal, linkMal, unlinkMal, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectMal() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await linkMal();
    if (message) setError(message);
    setBusy(false);
  }

  function confirmUnlink() {
    Alert.alert(
      "Unlink MyAnimeList?",
      "Progress will stop syncing to MyAnimeList. Your AniList account and everything on this device stay as they are.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: () => void unlinkMal(),
        },
      ]
    );
  }

  function confirmSignOut() {
    Alert.alert(
      "Sign out?",
      "This clears both tracker logins from this device. The library, saved Nyaa filters and discovered episodes stay — signing back in picks them up.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => void signOut(),
        },
      ]
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Settings" />

        <Text style={styles.sectionLabel}>Trackers</Text>

        <View style={styles.card}>
          <Account
            provider="AniList"
            tint={theme.color.anilist}
            name={anilist?.name ?? "Not signed in"}
            detail="Signed in — this is the account the library syncs with."
          />

          <View style={styles.divider} />

          <Account
            provider="MyAnimeList"
            tint={theme.color.mal}
            name={mal?.name ?? "Not linked"}
            detail={
              mal
                ? "Linked — progress is written here as well as to AniList."
                : "Optional. Link it and progress goes to both trackers."
            }
          />

          <View style={styles.cardActions}>
            {mal ? (
              <Button label="Unlink" variant="outline" size="sm" onPress={confirmUnlink} />
            ) : (
              <Button
                label="Link MyAnimeList"
                variant="outline"
                size="sm"
                busy={busy}
                disabled={!!MAL_CONFIG_ERROR}
                onPress={() => void connectMal()}
              />
            )}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {MAL_CONFIG_ERROR ? (
          <Text style={styles.hint}>{MAL_CONFIG_ERROR}</Text>
        ) : null}

        <View style={styles.actions}>
          <Button label="Sign out" variant="ghost" onPress={confirmSignOut} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Account({
  provider,
  tint,
  name,
  detail,
}: {
  provider: string;
  tint: string;
  name: string;
  detail: string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.providerRow}>
        <View style={[styles.dot, { backgroundColor: tint }]} />
        <Text style={styles.fieldLabel}>{provider}</Text>
      </View>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.fieldDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 32 },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 8,
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  divider: { height: 1, backgroundColor: theme.color.border },
  field: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fieldLabel: { color: theme.color.muted, fontSize: 12 },
  fieldValue: {
    color: theme.color.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  fieldDetail: { color: theme.color.muted, fontSize: 12, lineHeight: 17 },
  cardActions: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    alignItems: "flex-start",
  },
  error: { marginTop: 12, color: theme.color.danger, fontSize: 13 },
  hint: { marginTop: 12, color: theme.color.muted, fontSize: 12, lineHeight: 17 },
  actions: { marginTop: 20, gap: 10 },
});

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/context";
import { theme } from "@/theme";
import { Wordmark } from "@/ui/wordmark";

/**
 * Mirrors the web `/login`: one AniList button. `signIn()` opens the consent
 * page in the system browser via `@better-auth/expo` and resolves once the
 * `nekostream://` deep link returns; the gate then swaps this screen for the
 * app. MyAnimeList is linked later in settings (Phase 5).
 */
export default function LoginScreen() {
  const { serverUrl, signIn, changeServer } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await signIn();
    if (message) setError(message);
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Wordmark />
        <Text style={styles.title}>Your list, your episodes, your server.</Text>
        <Text style={styles.subtitle}>
          Sign in with AniList to pull in your library. Everything after that
          stays on your server.
        </Text>

        <Pressable
          style={[styles.button, busy && styles.buttonBusy]}
          onPress={connect}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#04131f" />
          ) : (
            <Text style={styles.buttonText}>Continue with AniList</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.footer}>
          <Text style={styles.footerText} numberOfLines={1}>
            {serverUrl}
          </Text>
          <Pressable onPress={changeServer} accessibilityRole="button">
            <Text style={styles.footerLink}>Change server</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  inner: { flex: 1, padding: 24, justifyContent: "center", gap: 12 },
  title: {
    color: theme.color.foreground,
    fontSize: 30,
    fontWeight: "600",
    lineHeight: 36,
    marginTop: 4,
  },
  subtitle: {
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    backgroundColor: theme.color.anilist,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: "#04131f", fontSize: 16, fontWeight: "700" },
  error: { color: theme.color.danger, fontSize: 13 },
  footer: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerText: { color: theme.color.muted, fontSize: 12, flexShrink: 1 },
  footerLink: { color: theme.color.accent, fontSize: 12, fontWeight: "600" },
});

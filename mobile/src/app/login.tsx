import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ANILIST_CONFIG_ERROR } from "@/auth/config";
import { useAuth } from "@/auth/context";
import { theme } from "@/theme";
import { Wordmark } from "@/ui/wordmark";

/**
 * Mirrors the web `/login`: one AniList button. `signIn()` opens AniList's
 * consent page in the system browser and resolves when the `nekostream://`
 * redirect returns the token; the gate then swaps this screen for the app.
 * MyAnimeList is optional and linked later from Settings.
 *
 * A build with no AniList client id can't get past this screen, so it says so
 * here rather than letting the browser open on an error page.
 */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(ANILIST_CONFIG_ERROR);
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
        <Text style={styles.title}>Your list, your episodes, your phone.</Text>
        <Text style={styles.subtitle}>
          Sign in with AniList to pull in your library. Everything after that
          stays on this device.
        </Text>

        <Pressable
          style={[styles.button, busy && styles.buttonBusy]}
          onPress={connect}
          disabled={busy || !!ANILIST_CONFIG_ERROR}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#04131f" />
          ) : (
            <Text style={styles.buttonText}>Continue with AniList</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.footerText}>
          MyAnimeList is optional — link it later in Settings.
        </Text>
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
  error: { color: theme.color.danger, fontSize: 13, lineHeight: 18 },
  footerText: {
    marginTop: 24,
    color: theme.color.muted,
    fontSize: 12,
    textAlign: "center",
  },
});

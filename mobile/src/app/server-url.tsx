import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/context";
import { theme } from "@/theme";

/**
 * Point the app at a different server. The URL is validated against
 * `GET /api/health` before it is stored (that check lives in
 * auth/server-url.ts) — a host that does not answer as NekoStream is rejected
 * here rather than failing later at sign-in.
 *
 * On a build with `extra.serverUrl` in app.json this is not the first-launch
 * screen any more; it is only reached from Settings → Change server, so it
 * offers a way back. Without that default it is still the first thing a new
 * install shows, and there is nothing to go back to.
 */
export default function ServerUrlScreen() {
  const { setServer, cancelServerChange, defaultServerUrl } = useAuth();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await setServer(value);
    if (message) {
      setError(message);
      setBusy(false);
    }
    // On success the gate re-renders this screen away; no need to reset busy.
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.title}>
          {defaultServerUrl ? "Use a different server" : "Connect to your server"}
        </Text>
        <Text style={styles.subtitle}>
          Enter the address where NekoStream is running. This is the same URL
          you open in a browser — on your LAN or its public hostname.
        </Text>

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder="https://nekostream.example.com"
          placeholderTextColor={theme.color.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          inputMode="url"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!busy}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, busy && styles.buttonBusy]}
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={theme.color.accentForeground} />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </Pressable>

        {defaultServerUrl ? (
          <Pressable
            onPress={() => void cancelServerChange()}
            disabled={busy}
            accessibilityRole="button"
            style={styles.cancel}
          >
            <Text style={styles.cancelText} numberOfLines={1}>
              Keep using {defaultServerUrl.replace(/^https?:\/\//, "")}
            </Text>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  inner: { flex: 1, padding: 24, justifyContent: "center", gap: 12 },
  title: {
    color: theme.color.foreground,
    fontSize: 26,
    fontWeight: "600",
  },
  subtitle: {
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    color: theme.color.foreground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: theme.color.danger, fontSize: 13 },
  button: {
    backgroundColor: theme.color.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    marginTop: 4,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: {
    color: theme.color.accentForeground,
    fontSize: 16,
    fontWeight: "600",
  },
  cancel: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  cancelText: { color: theme.color.accent, fontSize: 14, fontWeight: "600" },
});

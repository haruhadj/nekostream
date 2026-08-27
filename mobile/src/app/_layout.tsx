// First import in the app: patches AbortSignal.timeout, which every shared
// client calls and React Native does not ship. See src/polyfills.ts.
import "@/polyfills";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/auth/context";
import { MigrationsGate } from "@/db/migrations-gate";
import { theme } from "@/theme";

/**
 * The app-entry gate, replacing the per-page `getSession` + `redirect` that
 * every web page repeats. `Stack.Protected`'s `guard` picks exactly one
 * branch from `useAuth().status`:
 *   no-tracker -> login
 *   ready      -> (tabs)     (the app)
 * expo-router redirects to whichever branch's guard is true whenever
 * `status` changes, so signing in or out just flips this without any
 * imperative navigation.
 *
 * The `no-server` branch is gone with the server URL it guarded: the app
 * authenticates to AniList directly, so there is no host to enter and no
 * session to be signed out of by someone else.
 *
 * `MigrationsGate` sits outside all of it: the device database has to exist
 * before anything reads from it, and on this launch it may be a schema
 * version behind the code that just updated.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <MigrationsGate>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </MigrationsGate>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.color.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.color.background },
      }}
    >
      <Stack.Protected guard={status === "ready"}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>

      <Stack.Protected guard={status === "no-tracker"}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

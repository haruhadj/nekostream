import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/auth/context";
import { theme } from "@/theme";

/**
 * The app-entry gate, replacing the per-page `getSession` + `redirect` that
 * every web page repeats. `Stack.Protected`'s `guard` picks exactly one
 * branch from `useAuth().status`:
 *   no-server  -> server-url   (first launch)
 *   no-session -> login
 *   ready  -> (tabs)     (the app)
 * expo-router redirects to whichever branch's guard is true whenever
 * `status` changes, so signing in or out just flips this without any
 * imperative navigation.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
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

      <Stack.Protected guard={status === "no-session"}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={status === "no-server"}>
        <Stack.Screen name="server-url" />
      </Stack.Protected>
    </Stack>
  );
}

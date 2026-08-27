import Feather from "@expo/vector-icons/Feather";
// `Tabs` re-exported from "expo-router" itself is deprecated in SDK 57 — this
// is the same stable JS tab navigator under its current name. Deliberately not
// `expo-router/unstable-native-tabs`, which is what the SDK 57 template
// scaffolds; see ../context/progress-tracker.md's decision log.
import { Tabs } from "expo-router/js-tabs";

import { theme } from "@/theme";

/**
 * The four destinations from the web's `SiteHeader`, in the same order. The
 * web renders them twice — a top bar on desktop, a bottom tab bar on phones —
 * and only the second one has a counterpart here.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // Each screen draws its own title, matching the web pages.
        headerShown: false,
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.muted,
        tabBarStyle: {
          backgroundColor: theme.color.background,
          borderTopColor: theme.color.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => (
            <Feather name="book" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => (
            <Feather name="search" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

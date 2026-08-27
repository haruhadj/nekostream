/**
 * The web's `ui/badge.tsx` variants. React Native has no `bg-accent/15`, so
 * each translucent fill is pre-blended against the app's one background
 * (#09090b) — the app is dark-only, so there is nothing else to blend against.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { theme } from "@/theme";

type Variant = "default" | "outline" | "accent" | "warning";

export function Badge({
  label,
  variant = "default",
  style,
}: {
  label: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.badge, fills[variant], style]}>
      <Text style={[styles.label, labels[variant]]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "transparent",
  },
  label: { fontSize: 11, fontWeight: "600" },
});

const fills = StyleSheet.create({
  default: { backgroundColor: "#1b1b30" },
  outline: {
    backgroundColor: "transparent",
    borderColor: theme.color.border,
  },
  /** The solid one — reserved for "this is the next thing to happen". */
  accent: { backgroundColor: theme.color.accent },
  warning: { backgroundColor: "#2c2311" },
});

const labels = StyleSheet.create({
  default: { color: theme.color.accent },
  outline: { color: theme.color.muted },
  accent: { color: theme.color.accentForeground },
  warning: { color: theme.color.amberText },
});

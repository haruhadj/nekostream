/**
 * The app's name as an eyebrow. The web's `ui/wordmark.tsx` pairs the logo
 * mark with the text; here the mark is already the launcher icon and the app
 * title, so repeating it inside the app would say the same thing twice.
 */

import { StyleSheet, Text } from "react-native";

import { theme } from "@/theme";

export function Wordmark() {
  return <Text style={styles.wordmark}>NekoStream</Text>;
}

const styles = StyleSheet.create({
  wordmark: {
    color: theme.color.muted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});

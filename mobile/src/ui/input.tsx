/**
 * The web's `ui/input.tsx`, minus the parts a phone doesn't have. Wraps
 * TextInput so the border/height/placeholder treatment is declared once —
 * `placeholderTextColor` in particular has no stylesheet equivalent in React
 * Native and would otherwise be forgotten at half the call sites.
 */

import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { theme } from "@/theme";

export function Input({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.color.muted}
      selectionColor={theme.color.accent}
      style={[styles.input, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.background,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.color.foreground,
    fontSize: 15,
  },
});

/**
 * The web's `ui/button.tsx` variant/size scale, in StyleSheet form. Same
 * names, same roles — `primary` for the one real action, `outline` for the
 * settled/secondary state, `ghost` for something that should read as a control
 * but not compete.
 *
 * The web's 44px minimum touch target survives verbatim: it was already there
 * for phones, which is now the only target.
 */

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { theme } from "@/theme";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "default";

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "default",
  disabled = false,
  busy = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  /** Swaps the label for a spinner and blocks presses. */
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inert = disabled || busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy }}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        // Held at the label's own line height so the button doesn't resize
        // when the label is swapped out.
        <View style={spinnerStyles[size]}>
          <ActivityIndicator size="small" color={LABEL_COLOR[variant]} />
        </View>
      ) : (
        <Text
          numberOfLines={1}
          style={[styles.label, textSizeStyles[size], variantText[variant]]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  label: { fontWeight: "600" },
});

const sizeStyles = StyleSheet.create({
  sm: { minHeight: 36, paddingHorizontal: 14 },
  default: { minHeight: 44, paddingHorizontal: 16 },
});

const textSizeStyles = StyleSheet.create({
  sm: { fontSize: 12, lineHeight: 16 },
  default: { fontSize: 15, lineHeight: 20 },
});

const spinnerStyles = StyleSheet.create({
  sm: { height: 16, justifyContent: "center" },
  default: { height: 20, justifyContent: "center" },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: theme.color.accent },
  outline: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
  },
  ghost: { backgroundColor: theme.color.surface },
});

/** Named once so the label and the busy spinner can't drift apart. */
const LABEL_COLOR: Record<Variant, string> = {
  primary: theme.color.accentForeground,
  outline: theme.color.foreground,
  ghost: theme.color.muted,
};

const variantText = StyleSheet.create({
  primary: { color: LABEL_COLOR.primary },
  outline: { color: LABEL_COLOR.outline },
  ghost: { color: LABEL_COLOR.ghost },
});

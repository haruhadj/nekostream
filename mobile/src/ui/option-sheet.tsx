/**
 * A one-choice-from-a-list sheet, rising from the bottom edge.
 *
 * This is what the web's `<select>` becomes: React Native has no native
 * picker that matches a dark custom theme on both platforms, and a row of
 * chips for six sort orders would crowd out the seven filter chips already on
 * the library screen.
 *
 * Built on React Native's own `Modal` rather than a gesture-driven sheet
 * library — it is dismissed by tapping outside or picking an option, so there
 * is no drag to implement. Phase 5's draggable `Sheet` is a different
 * component with a different job.
 */

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/theme";

export type Option<T extends string> = { key: T; label: string };

export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly Option<T>[];
  selected: T;
  onSelect: (key: T) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Android's back gesture must dismiss the sheet, not the screen behind it.
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

      <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabHandle} />
        <Text style={styles.title}>{title}</Text>

        <ScrollView bounces={false}>
          {options.map((option) => {
            const isSelected = option.key === selected;

            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  onSelect(option.key);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text
                  style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}
                >
                  {option.label}
                </Text>
                {isSelected ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)" },
  panel: {
    maxHeight: "70%",
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  grabHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.color.border,
    marginBottom: 12,
  },
  title: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowPressed: { backgroundColor: theme.color.border },
  rowLabel: { color: theme.color.muted, fontSize: 15 },
  rowLabelSelected: { color: theme.color.foreground, fontWeight: "600" },
  check: { color: theme.color.accent, fontSize: 16, fontWeight: "700" },
});

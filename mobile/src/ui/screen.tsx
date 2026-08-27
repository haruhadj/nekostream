/**
 * The frame every tab shares: safe-area top inset, a title/subtitle block, and
 * the horizontal gutter. It is the phone equivalent of the web's
 * `SiteHeader` + `<main class="mx-auto max-w-5xl px-4 pt-6">` pair, minus the
 * navigation — that is the tab bar's job here.
 *
 * `ScreenTitle` is exported separately because the scrolling tabs put their
 * heading inside a list's `ListHeaderComponent`, where a wrapper that owns
 * the scroll view would be in the way.
 */

import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/theme";

/** Matches the web's `px-4` gutter. Exported so lists can inset their own rows. */
export const SCREEN_PADDING = 16;

export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>{children}</View>
  );
}

export function ScreenTitle({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  /** Right-aligned against the title — the library's title count. */
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {trailing}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** The first-load state, before there is anything to show. */
export function ScreenLoading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.color.accent} />
    </View>
  );
}

/**
 * The dashed-border empty box the web uses everywhere it has nothing to list.
 */
export function EmptyState({
  message,
  children,
}: {
  message: string;
  /** An action that resolves the emptiness — "Search anime", say. */
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
      {children ? <View style={styles.emptyAction}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingTop: 20, paddingBottom: 4 },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    color: theme.color.foreground,
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    marginTop: 40,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.color.border,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 44,
    alignItems: "center",
  },
  emptyText: {
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 280,
  },
  emptyAction: { marginTop: 24 },
});

/**
 * The episode stepper, ported from the web's `progress-control.tsx`.
 *
 * Two things carried over deliberately:
 *
 *  - **The optimistic update with revert-on-failure.** The number moves the
 *    instant it is tapped and rolls back only if the local write fails. It
 *    does *not* roll back when a tracker rejects the push — that write already
 *    succeeded locally, and undoing it on screen would be a lie about what the
 *    device holds.
 *  - **Per-tracker outcomes rendered as text**, so a MyAnimeList failure is
 *    visible without blocking AniList. That asymmetry is the whole point of
 *    the dual write.
 *
 * The web version is a context provider because its episode list marks
 * episodes watched through the same state. Here it is still plain props — the
 * episode list arrives in Phase 4, and that is when lifting this to a context
 * will actually buy something.
 */

import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PROVIDER_LABEL } from "@shared/providers";

import { theme } from "@/theme";
import type { SyncOutcome } from "@/sync/progress";

/**
 * Type guards rather than inline predicates: `SyncOutcome` is a discriminated
 * union and `Array.filter` does not narrow on its own.
 */
const isFailure = (
  outcome: SyncOutcome
): outcome is Extract<SyncOutcome, { ok: false }> => !outcome.ok;

const isSkipped = (
  outcome: SyncOutcome
): outcome is Extract<SyncOutcome, { skipped: true }> =>
  outcome.ok && outcome.skipped === true;

export function ProgressControl({
  progress,
  totalEpisodes,
  onChange,
}: {
  progress: number;
  totalEpisodes: number | null;
  /** Saves locally, pushes to the trackers, and reports what each one did. */
  onChange: (next: number) => Promise<SyncOutcome[]>;
}) {
  const [saving, setSaving] = useState(false);
  const [outcomes, setOutcomes] = useState<SyncOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function step(next: number) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setOutcomes(null);

    try {
      setOutcomes(await onChange(Math.max(0, next)));
    } catch (thrown) {
      setError(
        thrown instanceof Error ? thrown.message : "Could not save progress."
      );
    } finally {
      setSaving(false);
    }
  }

  const failures = outcomes?.filter(isFailure) ?? [];
  const skipped = outcomes?.filter(isSkipped) ?? [];
  const synced = outcomes?.filter((o) => o.ok && !o.skipped) ?? [];

  const status = saving
    ? "Saving…"
    : error
      ? error
      : failures.length > 0
        ? failures
            .map((f) => `${PROVIDER_LABEL[f.provider]}: ${f.error}`)
            .join(" · ")
        : skipped.length > 0
          ? skipped.map((s) => s.reason).join(" · ")
          : synced.length > 0
            ? `Synced to ${synced
                .map((s) => PROVIDER_LABEL[s.provider])
                .join(" and ")}`
            : "";

  return (
    <View style={styles.wrapper}>
      <View style={styles.stepper}>
        <StepButton
          label="Decrease progress"
          symbol="−"
          disabled={saving || progress <= 0}
          onPress={() => void step(progress - 1)}
        />

        <Text style={styles.count}>
          {progress}
          {totalEpisodes ? (
            <Text style={styles.total}> / {totalEpisodes}</Text>
          ) : null}
        </Text>

        <StepButton
          label="Increase progress"
          symbol="+"
          disabled={saving}
          onPress={() => void step(progress + 1)}
        />
      </View>

      {status ? (
        <Text
          style={[styles.status, failures.length > 0 || error ? styles.bad : null]}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Text>
      ) : null}
    </View>
  );
}

function StepButton({
  label,
  symbol,
  disabled,
  onPress,
}: {
  label: string;
  symbol: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      // The web drops to 28px once there's a pointer; a phone only ever has
      // the 44px touch target, so that is the only size here.
      style={({ pressed }) => [
        styles.step,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.stepSymbol}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    padding: 4,
  },
  step: {
    height: 44,
    width: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: theme.color.background },
  disabled: { opacity: 0.4 },
  stepSymbol: {
    color: theme.color.foreground,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
  },
  count: {
    minWidth: 80,
    textAlign: "center",
    color: theme.color.foreground,
    fontSize: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  total: { color: theme.color.muted, fontWeight: "400" },
  status: { color: theme.color.muted, fontSize: 12, lineHeight: 17 },
  bad: { color: theme.color.danger },
});

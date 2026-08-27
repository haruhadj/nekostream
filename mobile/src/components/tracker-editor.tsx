/**
 * The manual override — the port of the web's `tracker-editor.tsx`.
 *
 * Chips on the detail screen, each opening that tracker's *own* list entry for
 * editing. Progress, status and score are read live from the tracker rather
 * than from the local copy, so what you see is what the tracker actually
 * holds — which is the whole point of an override.
 *
 * "Both trackers" is offered first, deliberately: keeping the two lists
 * identical is the common case, and doing it here beats editing the same
 * numbers twice.
 */

import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PROVIDER_LABEL, PROVIDERS, type Provider } from "@shared/providers";
import type { MirrorStatus } from "@shared/sync/mirror";

import { useTrackerEntry } from "@/components/use-tracker-entry";
import type { LibraryEntryRow } from "@/db/library";
import { theme } from "@/theme";
import { Button } from "@/ui/button";

/** "both" edits one set of values and writes it to each tracker in turn. */
type Target = Provider | "both";

const targetProviders = (target: Target): Provider[] =>
  target === "both" ? PROVIDERS : [target];

const STATUS_LABELS: { value: MirrorStatus; label: string }[] = [
  { value: "watching", label: "Watching" },
  { value: "repeating", label: "Rewatching" },
  { value: "completed", label: "Completed" },
  { value: "paused", label: "On hold" },
  { value: "dropped", label: "Dropped" },
  { value: "planning", label: "Plan to watch" },
];

const TARGET: Record<Target, { label: string; accent: string }> = {
  anilist: { label: PROVIDER_LABEL.anilist, accent: theme.color.anilist },
  mal: { label: PROVIDER_LABEL.mal, accent: theme.color.mal },
  both: { label: "Both trackers", accent: theme.color.foreground },
};

export function TrackerEditors({
  entry,
  malLinked,
  onSaved,
}: {
  entry: LibraryEntryRow;
  /** False when MyAnimeList isn't linked on this device. */
  malLinked: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState<Target | null>(null);

  // Both conditions matter: an unlinked account has no token, and a title with
  // no `idMal` has nothing on MAL to edit.
  const malAvailable = malLinked && entry.malMediaId !== null;

  return (
    <View style={styles.chips}>
      {malAvailable ? (
        <TrackerChip target="both" onPress={() => setOpen("both")} />
      ) : null}
      <TrackerChip target="anilist" onPress={() => setOpen("anilist")} />
      <TrackerChip
        target="mal"
        disabled={!malAvailable}
        onPress={() => setOpen("mal")}
      />

      {open ? (
        <TrackerDialog
          entry={entry}
          target={open}
          onClose={() => setOpen(null)}
          onSaved={onSaved}
        />
      ) : null}
    </View>
  );
}

function TrackerChip({
  target,
  disabled,
  onPress,
}: {
  target: Target;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { label, accent } = TARGET[target];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        disabled
          ? `${label} — link MyAnimeList in Settings first`
          : target === "both"
            ? "Edit AniList and MyAnimeList together"
            : `Edit on ${label}`
      }
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: disabled ? theme.color.border : accent },
        disabled && styles.chipDisabled,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: disabled ? theme.color.muted : accent },
        ]}
      />
      <Text style={[styles.chipText, disabled && styles.chipTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TrackerDialog({
  entry,
  target,
  onClose,
  onSaved,
}: {
  entry: LibraryEntryRow;
  target: Target;
  onClose: () => void;
  onSaved: () => void;
}) {
  const providers = targetProviders(target);
  const { label } = TARGET[target];

  const autoSync =
    target === "mal"
      ? entry.syncMal
      : target === "anilist"
        ? entry.syncAnilist
        : entry.syncAnilist && entry.syncMal;

  const syncFlags = useCallback(
    (value: boolean) =>
      target === "both"
        ? { syncAnilist: value, syncMal: value }
        : target === "anilist"
          ? { syncAnilist: value }
          : { syncMal: value },
    [target]
  );

  const handleSaved = useCallback(() => {
    onSaved();
    onClose();
  }, [onSaved, onClose]);

  const {
    loading,
    saving,
    error,
    failures,
    form,
    setForm,
    sync,
    setSync,
    save,
    totalEpisodes,
    loadedEntries,
  } = useTrackerEntry({
    entry,
    providers,
    autoSync,
    syncFlags,
    onSaved: handleSaved,
  });

  const syncLabel = target === "both" ? "both trackers" : label;
  const failureList = Object.entries(failures) as [Provider, string][];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.color.accent} />
              <Text style={styles.hint}>
                Reading what {syncLabel} currently holds…
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.form}>
              {loadedEntries.length > 0 ? (
                <Text style={styles.hint}>
                  {loadedEntries
                    .map(([p, e]) =>
                      e.exists
                        ? `${PROVIDER_LABEL[p]}: ${e.progress}${e.totalEpisodes ? ` / ${e.totalEpisodes}` : ""}`
                        : `${PROVIDER_LABEL[p]}: not on your list`
                    )
                    .join("   ·   ")}
                </Text>
              ) : null}

              <Field label="Progress">
                <View style={styles.stepperRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decrease progress"
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        progress: Math.max(0, f.progress - 1),
                      }))
                    }
                    style={({ pressed }) => [styles.step, pressed && styles.pressed]}
                  >
                    <Text style={styles.stepSymbol}>−</Text>
                  </Pressable>

                  <Text style={styles.progressValue}>
                    {form.progress}
                    {totalEpisodes ? (
                      <Text style={styles.muted}> / {totalEpisodes}</Text>
                    ) : null}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase progress"
                    onPress={() =>
                      setForm((f) => ({ ...f, progress: f.progress + 1 }))
                    }
                    style={({ pressed }) => [styles.step, pressed && styles.pressed]}
                  >
                    <Text style={styles.stepSymbol}>+</Text>
                  </Pressable>
                </View>
              </Field>

              <Field label="Status">
                <View style={styles.optionWrap}>
                  {STATUS_LABELS.map((option) => {
                    const selected = form.status === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() =>
                          setForm((f) => ({ ...f, status: option.value }))
                        }
                        style={({ pressed }) => [
                          styles.option,
                          selected ? styles.optionOn : styles.optionOff,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[styles.optionText, selected && styles.optionTextOn]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Score">
                <View style={styles.optionWrap}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
                    const selected = form.score === value;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityLabel={value === 0 ? "No score" : `Score ${value}`}
                        accessibilityState={{ selected }}
                        onPress={() => setForm((f) => ({ ...f, score: value }))}
                        style={({ pressed }) => [
                          styles.score,
                          selected ? styles.optionOn : styles.optionOff,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[styles.optionText, selected && styles.optionTextOn]}
                        >
                          {value === 0 ? "–" : value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Automatic sync">
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: sync }}
                  onPress={() => setSync((value) => !value)}
                  style={({ pressed }) => [
                    styles.switchRow,
                    sync ? styles.switchOn : styles.optionOff,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.switchTrack, sync && styles.trackOn]}>
                    <View style={[styles.knob, sync && styles.knobOn]} />
                  </View>
                  <Text style={styles.switchText}>
                    {sync
                      ? `Marking episodes here updates ${syncLabel}.`
                      : `Marking episodes here does not touch ${syncLabel}.`}
                  </Text>
                </Pressable>
              </Field>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {failureList.map(([p, message]) => (
                <Text key={p} style={styles.error}>
                  {PROVIDER_LABEL[p]}: {message}
                </Text>
              ))}

              <View style={styles.actions}>
                <Button
                  label={
                    saving
                      ? "Saving…"
                      : target === "both"
                        ? "Save to both"
                        : `Save to ${label}`
                  }
                  busy={saving}
                  onPress={() => void save()}
                  style={styles.saveButton}
                />
                <Button label="Cancel" variant="outline" onPress={onClose} />
              </View>

              <Text style={styles.hint}>
                {target === "anilist"
                  ? "Writes to AniList and updates the local library."
                  : target === "mal"
                    ? "Writes to MyAnimeList only — the local library follows AniList."
                    : "Writes the same values to AniList and MyAnimeList, and updates the local library."}
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: theme.color.surface,
  },
  chipDisabled: { opacity: 0.5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { color: theme.color.foreground, fontSize: 12, fontWeight: "600" },
  chipTextDisabled: { color: theme.color.muted },
  pressed: { opacity: 0.75 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: theme.color.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  sheetTitle: { color: theme.color.foreground, fontSize: 16, fontWeight: "700" },
  close: { color: theme.color.muted, fontSize: 18 },
  loading: { padding: 40, alignItems: "center", gap: 12 },
  form: { padding: 20, gap: 20 },
  field: { gap: 10 },
  fieldLabel: {
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  step: {
    height: 44,
    width: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepSymbol: { color: theme.color.foreground, fontSize: 20, fontWeight: "600" },
  progressValue: {
    color: theme.color.foreground,
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  muted: { color: theme.color.muted, fontWeight: "400" },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  score: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
  },
  optionOn: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.accent,
  },
  optionOff: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
  },
  optionText: { color: theme.color.foreground, fontSize: 13, fontWeight: "600" },
  optionTextOn: { color: theme.color.accentForeground },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  switchOn: { backgroundColor: "#6366f11a", borderColor: theme.color.accent },
  switchTrack: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.color.border,
    padding: 3,
    justifyContent: "center",
  },
  trackOn: { backgroundColor: theme.color.accent },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.color.muted,
  },
  knobOn: { backgroundColor: theme.color.accentForeground, marginLeft: 16 },
  switchText: {
    flex: 1,
    color: theme.color.foreground,
    fontSize: 12,
    lineHeight: 17,
  },
  error: { color: theme.color.danger, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", gap: 10 },
  saveButton: { flex: 1 },
  hint: { color: theme.color.muted, fontSize: 11, lineHeight: 16 },
});

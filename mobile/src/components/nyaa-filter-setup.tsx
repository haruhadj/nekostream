/**
 * Picking a release group and quality for one anime — the port of the web's
 * `nyaa-filter-setup.tsx`.
 *
 * It probes Nyaa on open so the user chooses from groups that actually exist
 * rather than typing a query blind. `discoverFilters` and `buildQuery` are
 * shared with the server, so "what counts as a group" and "how the `q` value
 * is composed" have one definition.
 */

import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { buildQuery, discoverFilters, type DiscoveryResult } from "@shared/nyaa/discover";
import type { SavedFilter } from "@shared/nyaa/filter";

import { theme } from "@/theme";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function NyaaFilterSetup({
  defaultTitle,
  savedFilter,
  onSave,
  onCancel,
}: {
  defaultTitle: string;
  savedFilter: SavedFilter | null;
  /** Saves the feed and loads episodes. Returns an error string, or null. */
  onSave: (filter: SavedFilter) => Promise<string | null>;
  /** Only offered when there is a saved feed to go back to. */
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(savedFilter?.query ?? defaultTitle);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [group, setGroup] = useState<string | null>(
    savedFilter?.releaseGroup ?? null
  );
  const [quality, setQuality] = useState<string | null>(
    savedFilter?.quality ?? null
  );

  // Starts true rather than being flipped on inside the mount effect: the
  // component genuinely is probing from its first render, and saying so in the
  // initial state avoids a setState the effect would otherwise do
  // synchronously.
  const [probing, setProbing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Applies a finished probe. Shared by the mount effect and the button. */
  function apply(discovered: DiscoveryResult) {
    setDiscovery(discovered);
    // Only preselect when the user hasn't already chosen.
    setQuality((q) => q ?? discovered.defaultQuality);
    setGroup(
      (g) =>
        g ?? discovered.groups.find((x) => x.recommended)?.releaseGroup ?? null
    );
  }

  function describe(thrown: unknown) {
    return thrown instanceof Error ? thrown.message : "Could not search Nyaa.";
  }

  async function probe(searchTitle: string) {
    setProbing(true);
    setError(null);

    try {
      apply(await discoverFilters(searchTitle));
    } catch (thrown) {
      setError(describe(thrown));
    } finally {
      setProbing(false);
    }
  }

  // Probe once on open so the picker is never empty. A fetch on mount is
  // exactly what an effect is for.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const discovered = await discoverFilters(
          savedFilter?.query ?? defaultTitle
        );
        if (!cancelled) apply(discovered);
      } catch (thrown) {
        if (!cancelled) setError(describe(thrown));
      }
      if (!cancelled) setProbing(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const composedQuery = buildQuery(title, { releaseGroup: group, quality });

  async function save() {
    setSaving(true);
    setError(null);

    const message = await onSave({
      query: composedQuery,
      category: savedFilter?.category ?? "1_2",
      filter: savedFilter?.filter ?? "0",
      releaseGroup: group,
      quality,
    });

    if (message) setError(message);
    setSaving(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Nyaa feed</Text>
      <Text style={styles.blurb}>
        Pick a release group and quality. The episode list is built from this
        search.
      </Text>

      <View style={styles.searchRow}>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Search terms"
          autoCorrect={false}
          style={styles.searchInput}
          accessibilityLabel="Nyaa search terms"
        />
        <Button
          label={probing ? "Searching…" : "Search"}
          variant="outline"
          size="sm"
          busy={probing}
          onPress={() => void probe(title)}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {discovery ? (
        <>
          <Picker
            label="Quality"
            options={discovery.qualities}
            selected={quality}
            onSelect={setQuality}
          />

          <Picker
            label="Release group"
            options={discovery.groups.map((g) => g.releaseGroup)}
            hints={Object.fromEntries(
              discovery.groups.map((g) => [
                g.releaseGroup,
                `${g.releaseCount} releases`,
              ])
            )}
            selected={group}
            onSelect={setGroup}
          />

          {discovery.groups.length === 0 ? (
            <Text style={styles.blurb}>
              No releases matched. Try different search terms.
            </Text>
          ) : null}
        </>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerLabel}>Feed search</Text>
        <Text style={styles.query}>{composedQuery || "—"}</Text>

        <Button
          label={saving ? "Saving…" : "Save feed and load episodes"}
          busy={saving}
          disabled={!composedQuery.trim()}
          onPress={() => void save()}
          style={styles.saveButton}
        />

        {onCancel ? (
          <Pressable onPress={onCancel} accessibilityRole="button">
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Picker({
  label,
  options,
  hints,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  hints?: Record<string, string>;
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  if (options.length === 0) return null;

  return (
    <View style={styles.picker}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const isSelected = selected === option;

          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              // Tapping the active chip clears it — "any group" is valid.
              onPress={() => onSelect(isSelected ? null : option)}
              style={({ pressed }) => [
                styles.chip,
                isSelected ? styles.chipOn : styles.chipOff,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected ? styles.chipTextOn : styles.chipTextOff,
                ]}
              >
                {option}
                {hints?.[option] ? (
                  <Text style={styles.chipHint}> · {hints[option]}</Text>
                ) : null}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    padding: 16,
    gap: 10,
  },
  heading: { color: theme.color.foreground, fontSize: 14, fontWeight: "700" },
  blurb: { color: theme.color.muted, fontSize: 13, lineHeight: 19 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  searchInput: { flex: 1 },
  error: { color: theme.color.danger, fontSize: 13, lineHeight: 18 },
  picker: { marginTop: 6, gap: 8 },
  pickerLabel: {
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  chipOn: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.accent,
  },
  chipOff: {
    backgroundColor: theme.color.background,
    borderColor: theme.color.border,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  chipTextOn: { color: theme.color.accentForeground },
  chipTextOff: { color: theme.color.foreground },
  chipHint: { fontWeight: "400", opacity: 0.75 },
  pressed: { opacity: 0.75 },
  footer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: 14,
    gap: 8,
  },
  footerLabel: { color: theme.color.muted, fontSize: 11 },
  query: {
    color: theme.color.foreground,
    fontSize: 12,
    fontFamily: "monospace",
  },
  saveButton: { marginTop: 6 },
  cancel: {
    marginTop: 4,
    color: theme.color.muted,
    fontSize: 12,
    textAlign: "center",
  },
});

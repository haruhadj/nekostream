/**
 * Reading and writing one anime's entry on one or both trackers — the port of
 * the web's `use-tracker-entry.ts`, with its two rules intact:
 *
 *  - **Seed from whichever tracker is furthest along.** Editing both at once is
 *    usually done to bring a lagging list up, and silently proposing the lower
 *    number would quietly undo progress on the other side.
 *  - **Save sequentially, not in parallel.** Writing the same values to two
 *    APIs is not worth two concurrent bursts, and ordering makes the failure
 *    report easier to reason about. Note this is the *opposite* of
 *    `sync/progress.ts`, which fires both at once — there the point is that one
 *    tracker must never block the other; here the user is watching a dialog.
 *
 * What changed from the web: `apiRequest`/`apiSend` become direct tracker calls
 * and a local database write. The orchestration is untouched.
 */

import { useCallback, useEffect, useState } from "react";

import type { Provider } from "@shared/providers";
import type { MirrorStatus } from "@shared/sync/mirror";

import { setSyncFlags, type LibraryEntryRow } from "@/db/library";
import {
  readTrackerEntry,
  writeTrackerEntry,
  type TrackerEntry,
  type TrackerForm,
} from "@/sync/tracker";

export type { TrackerForm };

type Options = {
  entry: LibraryEntryRow;
  providers: Provider[];
  /** Whether this entry currently pushes progress to the target tracker(s). */
  autoSync: boolean;
  /** Applied to every provider when the target is "both", else just the one. */
  syncFlags: (sync: boolean) => { syncAnilist?: boolean; syncMal?: boolean };
  onSaved: () => void;
};

export function useTrackerEntry({
  entry,
  providers,
  autoSync,
  syncFlags,
  onSaved,
}: Options) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<
    Partial<Record<Provider, TrackerEntry>>
  >({});
  const [failures, setFailures] = useState<Partial<Record<Provider, string>>>(
    {}
  );
  const [form, setForm] = useState<TrackerForm>({
    progress: 0,
    status: "watching",
    score: 0,
  });
  const [sync, setSync] = useState(autoSync);

  const key = providers.join(",");
  const entryId = entry.id;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const loaded: Partial<Record<Provider, TrackerEntry>> = {};
      const errors: Partial<Record<Provider, string>> = {};

      await Promise.all(
        providers.map(async (p) => {
          try {
            loaded[p] = await readTrackerEntry(entry, p);
          } catch (thrown) {
            errors[p] =
              thrown instanceof Error
                ? thrown.message
                : "Could not read this tracker.";
          }
        })
      );

      if (cancelled) return;

      setEntries(loaded);
      setFailures(errors);

      const seed = providers
        .map((p) => loaded[p])
        .filter((e): e is TrackerEntry => e !== undefined)
        .sort((a, b) => b.progress - a.progress)[0];

      if (seed) {
        setForm({
          progress: seed.progress,
          status: seed.status ?? "watching",
          score: seed.score,
        });
      } else if (Object.keys(errors).length === providers.length) {
        setError(
          providers.length > 1
            ? "Could not read either tracker."
            : (errors[providers[0]] ?? "Could not read this tracker.")
        );
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `providers` is derived from the dialog's target and stable for a given
    // one; `key` is its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, key]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setFailures({});

    const errors: Partial<Record<Provider, string>> = {};

    for (const p of providers) {
      try {
        await writeTrackerEntry(entry, p, form);
      } catch (thrown) {
        errors[p] =
          thrown instanceof Error ? thrown.message : "Could not save.";
      }
    }

    // One tracker failing must not discard the write that did land, so the
    // dialog stays open reporting exactly which side is out of step.
    if (Object.keys(errors).length > 0) {
      setFailures(errors);
      setSaving(false);
      onSaved();
      return;
    }

    // The auto-sync flag is local state, not tracker state — a different write,
    // and only when actually changed.
    if (sync !== autoSync) {
      try {
        await setSyncFlags(entryId, syncFlags(sync));
      } catch (thrown) {
        setFailures({
          [providers[0]]:
            thrown instanceof Error
              ? thrown.message
              : "Could not change the sync setting.",
        });
        setSaving(false);
        onSaved();
        return;
      }
    }

    setSaving(false);
    onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, entry, entryId, form, key, onSaved, sync, syncFlags]);

  /** The episode count, from whichever tracker reported one. */
  const totalEpisodes =
    providers
      .map((p) => entries[p]?.totalEpisodes)
      .find((value) => typeof value === "number") ?? null;

  const loadedEntries = providers
    .map((p) => [p, entries[p]] as const)
    .filter((pair): pair is [Provider, TrackerEntry] => pair[1] !== undefined);

  return {
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
  };
}

export type { MirrorStatus };

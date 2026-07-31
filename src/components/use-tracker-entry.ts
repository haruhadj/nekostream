"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest, apiSend } from "@/lib/client/request";
import type { Provider } from "@/lib/providers";
import type { MirrorStatus } from "@/lib/sync/mirror";
import type { TrackerEntry } from "@/lib/sync/tracker-entry";

export type TrackerForm = {
  progress: number;
  status: MirrorStatus;
  score: number;
};

type Options = {
  entryId: string;
  providers: Provider[];
  /** Which providers the entry currently pushes progress to. */
  autoSync: boolean;
  /** Applied to every provider when target is "both", else to just the one. */
  syncFlags: (sync: boolean) => Record<string, boolean>;
  onSaved: () => void;
};

/**
 * Reading and writing one anime's entry on one or both trackers.
 *
 * Split out of the dialog so the component is markup: the dialog was 440 lines
 * of fetching, orchestration and form rendering in a single function.
 */
export function useTrackerEntry({
  entryId,
  providers,
  autoSync,
  syncFlags,
  onSaved,
}: Options) {
  const router = useRouter();

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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const loaded: Partial<Record<Provider, TrackerEntry>> = {};
      const errors: Partial<Record<Provider, string>> = {};

      await Promise.all(
        providers.map(async (p) => {
          const result = await apiRequest<{ tracker: TrackerEntry }>(
            `/api/library/${entryId}/tracker/${p}`,
            { fallbackError: "Could not read this tracker." }
          );

          if (result.ok) loaded[p] = result.data.tracker;
          else errors[p] = result.error;
        })
      );

      if (cancelled) return;

      setEntries(loaded);
      setFailures(errors);

      // Seed from whichever tracker is furthest along. Editing both at once is
      // usually done to bring a lagging list up, and silently proposing the
      // lower number would quietly undo progress on the other side.
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
    // providers is derived from the dialog's target and stable for a given one;
    // `key` is its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, key]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setFailures({});

    // Sequential, not parallel: writing the same values to two APIs is not
    // worth two concurrent bursts, and ordering makes the failure report
    // easier to reason about.
    const errors: Partial<Record<Provider, string>> = {};

    for (const p of providers) {
      const result = await apiSend(
        `/api/library/${entryId}/tracker/${p}`,
        "PUT",
        form,
        { fallbackError: "Could not save." }
      );

      if (!result.ok) errors[p] = result.error;
    }

    // One tracker failing must not discard the write that did land, so the
    // dialog stays open reporting exactly which side is out of step.
    if (Object.keys(errors).length > 0) {
      setFailures(errors);
      setSaving(false);
      router.refresh();
      return;
    }

    // The auto-sync flag is local state, not tracker state, so it goes to a
    // different endpoint — and only when actually changed.
    if (sync !== autoSync) {
      const result = await apiSend(
        `/api/library/${entryId}`,
        "PATCH",
        syncFlags(sync),
        { fallbackError: "Could not change the sync setting." }
      );

      if (!result.ok) {
        setFailures({ [providers[0]]: result.error });
        setSaving(false);
        router.refresh();
        return;
      }
    }

    router.refresh();
    onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, entryId, form, key, onSaved, router, sync, syncFlags]);

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

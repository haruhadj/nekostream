"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PROVIDER_LABEL, PROVIDERS, type Provider } from "@/lib/providers";
import type { MirrorStatus as Status } from "@/lib/sync/mirror";
import { apiRequest, apiSend } from "@/lib/client/request";
import type { TrackerEntry } from "@/lib/sync/tracker-entry";

/** "both" edits one set of values and writes it to each tracker in turn. */
type Target = Provider | "both";

const targetProviders = (target: Target): Provider[] =>
  target === "both" ? PROVIDERS : [target];

const STATUS_LABELS: { value: Status; label: string }[] = [
  { value: "watching", label: "Watching" },
  { value: "repeating", label: "Rewatching" },
  { value: "completed", label: "Completed" },
  { value: "paused", label: "On hold" },
  { value: "dropped", label: "Dropped" },
  { value: "planning", label: "Plan to watch" },
];

const PROVIDER: Record<Target, { label: string; accent: string }> = {
  anilist: { label: PROVIDER_LABEL.anilist, accent: "var(--anilist)" },
  mal: { label: PROVIDER_LABEL.mal, accent: "var(--mal)" },
  both: { label: "Both trackers", accent: "var(--cream)" },
};

/**
 * The two tracker chips on an anime page. Each opens that tracker's own list
 * entry for editing — progress, status and score are read live from the
 * tracker, not from the local copy, so what is shown is what the tracker
 * actually holds.
 */
export function TrackerEditors({
  entryId,
  malAvailable,
  syncAnilist,
  syncMal,
}: {
  entryId: string;
  /** False when the title has no MAL id or the account isn't linked. */
  malAvailable: boolean;
  syncAnilist: boolean;
  syncMal: boolean;
}) {
  const [open, setOpen] = useState<Target | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      {/* Offered first: keeping the two lists identical is the common case,
          and doing it here beats editing the same numbers twice. */}
      {malAvailable ? (
        <TrackerChip provider="both" onClick={() => setOpen("both")} />
      ) : null}
      <TrackerChip provider="anilist" onClick={() => setOpen("anilist")} />
      <TrackerChip
        provider="mal"
        disabled={!malAvailable}
        onClick={() => setOpen("mal")}
      />

      {open ? (
        <TrackerDialog
          entryId={entryId}
          target={open}
          syncAnilist={syncAnilist}
          syncMal={syncMal}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

function TrackerChip({
  provider,
  disabled,
  onClick,
}: {
  provider: Target;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { label, accent } = PROVIDER[provider];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        disabled
          ? "Link MyAnimeList in settings first"
          : provider === "both"
            ? "Edit AniList and MyAnimeList together"
            : `Edit on ${label}`
      }
      style={disabled ? undefined : { borderColor: accent }}
      className={[
        "flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium",
        "min-h-[38px] transition hover:bg-surface active:translate-y-px",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream",
        disabled
          ? "cursor-not-allowed border-edge text-muted opacity-50"
          : "text-cream",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: accent }}
      />
      {label}
      <span aria-hidden="true" className="text-muted">
        ⌄
      </span>
    </button>
  );
}

function TrackerDialog({
  entryId,
  target,
  syncAnilist,
  syncMal,
  onClose,
}: {
  entryId: string;
  target: Target;
  /** Whether marking episodes here pushes to each tracker automatically. */
  syncAnilist: boolean;
  syncMal: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { label, accent } = PROVIDER[target];
  const providers = targetProviders(target);

  // "Both trackers" reads fine as a heading but not mid-sentence.
  const syncLabel =
    target === "both" ? "AniList and MyAnimeList" : PROVIDER[target].label;

  const autoSync =
    target === "mal"
      ? syncMal
      : target === "anilist"
        ? syncAnilist
        : syncAnilist && syncMal;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<
    Partial<Record<Provider, TrackerEntry>>
  >({});
  const [failures, setFailures] = useState<Partial<Record<Provider, string>>>(
    {}
  );
  const [form, setForm] = useState({
    progress: 0,
    status: "watching" as Status,
    score: 0,
  });
  const [sync, setSync] = useState(autoSync);

  const panelRef = useRef<HTMLDivElement>(null);

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
    // providers is derived from target and stable for a given target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, target]);

  // Escape closes, and focus moves into the panel so keyboard users are not
  // left behind on the page underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

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
      const flags =
        target === "both"
          ? { syncAnilist: sync, syncMal: sync }
          : target === "anilist"
            ? { syncAnilist: sync }
            : { syncMal: sync };

      // A failure here used to be swallowed by a bare .catch, so the toggle
      // could appear to stick while the entry kept its old setting.
      const result = await apiSend(`/api/library/${entryId}`, "PATCH", flags, {
        fallbackError: "Could not change the sync setting.",
      });

      if (!result.ok) {
        setFailures({ [providers[0]]: result.error });
        setSaving(false);
        router.refresh();
        return;
      }
    }

    router.refresh();
    onClose();
    // providers is derived from target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, entryId, form, onClose, router, sync, target]);

  const total =
    providers
      .map((p) => entries[p]?.totalEpisodes)
      .find((value) => typeof value === "number") ?? null;

  const loadedEntries = providers
    .map((p) => [p, entries[p]] as const)
    .filter((pair): pair is [Provider, TrackerEntry] => pair[1] !== undefined);

  const divergent =
    target === "both" &&
    loadedEntries.length === 2 &&
    (loadedEntries[0][1].progress !== loadedEntries[1][1].progress ||
      loadedEntries[0][1].status !== loadedEntries[1][1].status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${label} entry`}
        tabIndex={-1}
        className={[
          "w-full max-w-md rounded-t-2xl border border-edge bg-ink p-5 outline-none",
          "max-h-[90vh] overflow-y-auto sm:rounded-2xl",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ background: accent }}
            />
            {label}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-muted transition hover:bg-surface hover:text-cream"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted">
            Reading {target === "both" ? "both lists" : label}…
          </p>
        ) : (
          <>
            {loadedEntries
              .filter(([, e]) => !e.exists)
              .map(([p]) => (
                <p
                  key={p}
                  className="mt-4 rounded-lg border border-edge bg-surface/50 px-3 py-2 text-xs text-muted"
                >
                  Not on your {PROVIDER[p].label} list yet — saving adds it.
                </p>
              ))}

            {divergent ? (
              <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5">
                <p className="text-xs font-medium text-amber-300">
                  The two lists disagree
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {loadedEntries.map(([p, e]) => (
                    <li key={p} className="text-[11px] text-muted">
                      <span className="text-cream">{PROVIDER[p].label}</span>{" "}
                      {e.progress} ep · {e.status ?? "no status"}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-muted">
                  Saving writes the values below to both.
                </p>
              </div>
            ) : null}

            <div className="mt-5 space-y-5">
              <Field label="Status">
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_LABELS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, status: option.value }))
                      }
                      aria-pressed={form.status === option.value}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        form.status === option.value
                          ? "border-anilist bg-anilist text-ink"
                          : "border-edge text-muted hover:text-cream",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={`Episodes watched${total ? ` (of ${total})` : ""}`}>
                <div className="flex items-center gap-2">
                  <Stepper
                    label="One fewer episode"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        progress: Math.max(0, f.progress - 1),
                      }))
                    }
                  >
                    –
                  </Stepper>

                  <input
                    type="number"
                    min={0}
                    value={form.progress}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        progress: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-20 rounded-lg border border-edge bg-surface px-3 py-2 text-center text-sm tabular-nums outline-none focus-visible:border-anilist"
                  />

                  <Stepper
                    label="One more episode"
                    onClick={() =>
                      setForm((f) => ({ ...f, progress: f.progress + 1 }))
                    }
                  >
                    +
                  </Stepper>

                  {total ? (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          progress: total,
                          status: "completed",
                        }))
                      }
                      className="ml-1 rounded-full border border-edge px-3 py-1.5 text-xs text-muted transition hover:text-cream"
                    >
                      All {total}
                    </button>
                  ) : null}
                </div>
              </Field>

              <Field label="Score">
                <div className="flex flex-wrap gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, score: value }))}
                      aria-pressed={form.score === value}
                      className={[
                        "h-9 w-9 rounded-lg border text-xs font-medium tabular-nums transition",
                        form.score === value
                          ? "border-anilist bg-anilist text-ink"
                          : "border-edge text-muted hover:text-cream",
                      ].join(" ")}
                    >
                      {value === 0 ? "–" : value}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Automatic sync">
                <button
                  type="button"
                  role="switch"
                  aria-checked={sync}
                  onClick={() => setSync((value) => !value)}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                    sync ? "border-anilist bg-anilist/10" : "border-edge",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition",
                      sync ? "bg-anilist" : "bg-edge",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-4 w-4 rounded-full bg-ink transition",
                        sync ? "translate-x-4" : "translate-x-0",
                      ].join(" ")}
                    />
                  </span>
                  <span className="text-xs leading-snug">
                    {sync
                      ? `Marking episodes here updates ${syncLabel}.`
                      : `Marking episodes here does not touch ${syncLabel}.`}
                  </span>
                </button>
              </Field>
            </div>

            {error ? (
              <p className="mt-4 text-xs text-rose-400">{error}</p>
            ) : null}

            {Object.entries(failures).map(([p, message]) => (
              <p key={p} className="mt-2 text-xs text-rose-400">
                {PROVIDER[p as Provider].label}: {message}
              </p>
            ))}

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-xl bg-anilist px-4 py-3 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-60"
              >
                {saving
                  ? "Saving…"
                  : target === "both"
                    ? "Save to both"
                    : `Save to ${label}`}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-edge px-4 py-3 text-sm font-medium text-muted transition hover:text-cream"
              >
                Cancel
              </button>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              {target === "anilist"
                ? "Writes to AniList and updates the local library."
                : target === "mal"
                  ? "Writes to MyAnimeList only — the local library follows AniList."
                  : "Writes the same values to AniList and MyAnimeList, and updates the local library."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

function Stepper({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="h-10 w-10 rounded-lg border border-edge text-sm font-semibold transition hover:bg-surface"
    >
      {children}
    </button>
  );
}

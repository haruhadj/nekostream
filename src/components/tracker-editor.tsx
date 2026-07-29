"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Provider = "anilist" | "mal";

type Status =
  | "watching"
  | "planning"
  | "completed"
  | "dropped"
  | "paused"
  | "repeating";

type TrackerEntry = {
  exists: boolean;
  progress: number;
  status: Status | null;
  score: number;
  totalEpisodes: number | null;
};

const STATUS_LABELS: { value: Status; label: string }[] = [
  { value: "watching", label: "Watching" },
  { value: "repeating", label: "Rewatching" },
  { value: "completed", label: "Completed" },
  { value: "paused", label: "On hold" },
  { value: "dropped", label: "Dropped" },
  { value: "planning", label: "Plan to watch" },
];

const PROVIDER = {
  anilist: { label: "AniList", accent: "var(--anilist)" },
  mal: { label: "MyAnimeList", accent: "var(--mal)" },
} as const;

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
  const [open, setOpen] = useState<Provider | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      <TrackerChip provider="anilist" onClick={() => setOpen("anilist")} />
      <TrackerChip
        provider="mal"
        disabled={!malAvailable}
        onClick={() => setOpen("mal")}
      />

      {open ? (
        <TrackerDialog
          entryId={entryId}
          provider={open}
          autoSync={open === "anilist" ? syncAnilist : syncMal}
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
  provider: Provider;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { label, accent } = PROVIDER[provider];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Link MyAnimeList in settings first" : `Edit on ${label}`}
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
  provider,
  autoSync,
  onClose,
}: {
  entryId: string;
  provider: Provider;
  /** Whether marking episodes here pushes to this tracker automatically. */
  autoSync: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { label, accent } = PROVIDER[provider];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<TrackerEntry | null>(null);
  const [form, setForm] = useState({
    progress: 0,
    status: "watching" as Status,
    score: 0,
  });
  const [sync, setSync] = useState(autoSync);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/library/${entryId}/tracker/${provider}`);
        const json = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(json.error ?? "Could not read this tracker.");
          setLoading(false);
          return;
        }

        const tracker = json.tracker as TrackerEntry;
        setEntry(tracker);
        setForm({
          progress: tracker.progress,
          status: tracker.status ?? "watching",
          score: tracker.score,
        });
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Could not reach the server.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entryId, provider]);

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

    try {
      const res = await fetch(`/api/library/${entryId}/tracker/${provider}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Could not save.");
        setSaving(false);
        return;
      }

      // The auto-sync flag is local state, not tracker state, so it goes to a
      // different endpoint — and only when actually changed.
      if (sync !== autoSync) {
        await fetch(`/api/library/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            provider === "anilist" ? { syncAnilist: sync } : { syncMal: sync }
          ),
        });
      }

      router.refresh();
      onClose();
    } catch {
      setError("Could not reach the server.");
      setSaving(false);
    }
  }, [autoSync, entryId, form, onClose, provider, router, sync]);

  const total = entry?.totalEpisodes ?? null;

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
          <p className="mt-6 text-sm text-muted">Reading {label}…</p>
        ) : (
          <>
            {entry && !entry.exists ? (
              <p className="mt-4 rounded-lg border border-edge bg-surface/50 px-3 py-2 text-xs text-muted">
                Not on your {label} list yet — saving adds it.
              </p>
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

              <Field
                label={`Episodes watched${total ? ` (of ${total})` : ""}`}
              >
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
                      ? `Marking episodes here updates ${label}.`
                      : `Marking episodes here does not touch ${label}.`}
                  </span>
                </button>
              </Field>
            </div>

            {error ? (
              <p className="mt-4 text-xs text-rose-400">{error}</p>
            ) : null}

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-xl bg-anilist px-4 py-3 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Saving…" : `Save to ${label}`}
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
              {provider === "anilist"
                ? "Writes to AniList and updates the local library."
                : "Writes to MyAnimeList only — the local library follows AniList."}
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

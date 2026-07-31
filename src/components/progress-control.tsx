"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";

import { PROVIDER_LABEL } from "@/lib/providers";
import type { SyncOutcome } from "@/lib/sync/progress";

type ProgressContextValue = {
  progress: number;
  totalEpisodes: number | null;
  saving: boolean;
  status: string;
  setProgress: (next: number) => Promise<void>;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

/**
 * Type guards rather than inline predicates: SyncOutcome is a discriminated
 * union, and only these variants carry `error` and `reason`. Array.filter does
 * not narrow on its own.
 */
const isFailure = (
  outcome: SyncOutcome
): outcome is Extract<SyncOutcome, { ok: false }> => !outcome.ok;

const isSkipped = (
  outcome: SyncOutcome
): outcome is Extract<SyncOutcome, { skipped: true }> =>
  outcome.ok && outcome.skipped === true;

export function ProgressProvider({
  entryId,
  initialProgress,
  totalEpisodes,
  children,
}: {
  entryId: string;
  initialProgress: number;
  totalEpisodes: number | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [progress, setProgressState] = useState(initialProgress);
  const [saving, setSaving] = useState(false);
  const [outcomes, setOutcomes] = useState<SyncOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setProgress = useCallback(
    async (next: number) => {
      const clamped = Math.max(0, next);
      const previous = progress;

      setProgressState(clamped);
      setSaving(true);
      setError(null);
      setOutcomes(null);

      try {
        const res = await fetch(`/api/library/${entryId}/progress`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress: clamped }),
        });
        const json = await res.json();

        if (!res.ok) {
          setProgressState(previous);
          setError(json.error ?? "Could not save progress.");
          return;
        }

        setOutcomes(json.sync ?? []);
        router.refresh();
      } catch {
        setProgressState(previous);
        setError("Could not reach the server.");
      } finally {
        setSaving(false);
      }
    },
    [entryId, progress, router]
  );

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
            ? `Synced to ${synced.map((s) => PROVIDER_LABEL[s.provider]).join(" and ")}`
            : "";

  return (
    <ProgressContext.Provider
      value={{ progress, totalEpisodes, saving, status, setProgress }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

/** The stepper itself, so it can sit next to the title while the episode
 *  list consumes the same state further down the page. */
export function ProgressControl() {
  const { progress, totalEpisodes, saving, status, setProgress } =
    useProgress();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-full border border-edge bg-ink/40 p-1">
        <StepButton
          label="Decrease progress"
          disabled={saving || progress <= 0}
          onClick={() => setProgress(progress - 1)}
        >
          –
        </StepButton>

        <span className="min-w-20 text-center text-base font-medium tabular-nums sm:text-sm">
          {progress}
          {totalEpisodes ? (
            <span className="text-muted"> / {totalEpisodes}</span>
          ) : null}
        </span>

        <StepButton
          label="Increase progress"
          disabled={saving}
          onClick={() => setProgress(progress + 1)}
        >
          +
        </StepButton>
      </div>

      <p className="text-xs text-muted" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

/** Lets the episode list mark an episode watched without prop drilling. */
export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress must be used inside ProgressProvider");
  }
  return context;
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      // 44px on touch, back to a compact 28px once there is a pointer.
      className="h-11 w-11 rounded-full text-lg font-semibold transition hover:bg-surface active:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream disabled:opacity-40 sm:h-7 sm:w-7 sm:text-sm"
    >
      {children}
    </button>
  );
}

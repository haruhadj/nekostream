"use client";

import { useMemo, useState } from "react";

type Side = "anilist" | "mal";
type Choice = Side | "skip";

type MirrorSide = {
  progress: number;
  status: string | null;
  updatedAt: string | null;
};

type Row = {
  key: string;
  title: string;
  anilistMediaId: number | null;
  malMediaId: number | null;
  totalEpisodes: number | null;
  anilist: MirrorSide | null;
  mal: MirrorSide | null;
  differences: string[];
  suggestion: Side;
};

type Plan = {
  rows: Row[];
  inSyncCount: number;
  unmappable: { title: string; anilistMediaId: number }[];
};

type ApplyResult = {
  applied: number;
  failed: number;
  results: { key: string; title: string; ok: boolean; error?: string }[];
};

type Phase =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "reviewing"; plan: Plan }
  | { kind: "applying"; plan: Plan }
  | { kind: "done"; plan: Plan; result: ApplyResult }
  | { kind: "error"; message: string };

export function MirrorReview() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Every row starts on "skip": nothing is written to either real account
  // unless it was chosen deliberately.
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  async function scan() {
    setPhase({ kind: "scanning" });
    try {
      const res = await fetch("/api/mirror");
      const json = await res.json();
      if (!res.ok) {
        setPhase({
          kind: "error",
          message: json.error ?? "Could not compare.",
        });
        return;
      }
      setChoices({});
      setPhase({ kind: "reviewing", plan: json as Plan });
    } catch {
      setPhase({ kind: "error", message: "Could not reach the server." });
    }
  }

  async function apply(plan: Plan) {
    const decisions = Object.entries(choices)
      .filter(([, side]) => side !== "skip")
      .map(([key, side]) => ({ key, side: side as Side }));

    if (decisions.length === 0) return;

    setPhase({ kind: "applying", plan });
    try {
      const res = await fetch("/api/mirror/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPhase({ kind: "error", message: json.error ?? "Could not apply." });
        return;
      }
      setPhase({ kind: "done", plan, result: json as ApplyResult });
    } catch {
      setPhase({ kind: "error", message: "Could not reach the server." });
    }
  }

  function setAll(plan: Plan, value: Choice | "suggestion") {
    const next: Record<string, Choice> = {};
    for (const row of plan.rows) {
      next[row.key] = value === "suggestion" ? row.suggestion : value;
    }
    setChoices(next);
  }

  if (phase.kind === "idle" || phase.kind === "error") {
    return (
      <div>
        {phase.kind === "error" ? (
          <p className="mb-5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {phase.message}
          </p>
        ) : null}
        <PrimaryButton onClick={scan}>Compare both lists</PrimaryButton>
        <p className="mt-3 text-xs text-muted">
          Reads both accounts and shows what differs. Nothing is written until
          you choose.
        </p>
      </div>
    );
  }

  if (phase.kind === "scanning") {
    return <p className="text-sm text-muted">Reading both lists…</p>;
  }

  const plan = phase.plan;
  const chosenCount = Object.values(choices).filter((c) => c !== "skip").length;

  return (
    <div>
      <Summary plan={plan} />

      {phase.kind === "done" ? (
        <Results result={phase.result} onRescan={scan} />
      ) : plan.rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-edge bg-surface/50 px-4 py-3 text-sm text-muted">
          Both lists already agree on every title they share.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <BulkButton onClick={() => setAll(plan, "suggestion")}>
              Use suggested
            </BulkButton>
            <BulkButton onClick={() => setAll(plan, "anilist")}>
              AniList for all
            </BulkButton>
            <BulkButton onClick={() => setAll(plan, "mal")}>
              MAL for all
            </BulkButton>
            <BulkButton onClick={() => setAll(plan, "skip")}>Clear</BulkButton>
          </div>

          <ul className="mt-5 space-y-3">
            {plan.rows.map((row) => (
              <RowCard
                key={row.key}
                row={row}
                choice={choices[row.key] ?? "skip"}
                onChoose={(value) =>
                  setChoices((prev) => ({ ...prev, [row.key]: value }))
                }
              />
            ))}
          </ul>

          <div className="sticky bottom-0 mt-6 border-t border-edge bg-ink/95 py-4 backdrop-blur">
            <PrimaryButton
              onClick={() => apply(plan)}
              disabled={chosenCount === 0 || phase.kind === "applying"}
            >
              {phase.kind === "applying"
                ? "Writing…"
                : chosenCount === 0
                  ? "Choose a side to continue"
                  : `Apply ${chosenCount} ${chosenCount === 1 ? "change" : "changes"}`}
            </PrimaryButton>
            <p className="mt-2 text-xs text-muted">
              {plan.rows.length - chosenCount} left untouched.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Summary({ plan }: { plan: Plan }) {
  return (
    <dl className="grid grid-cols-3 gap-3">
      <Stat label="Already agree" value={plan.inSyncCount} />
      <Stat label="Differ" value={plan.rows.length} />
      <Stat label="No MAL entry" value={plan.unmappable.length} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-edge bg-surface/50 px-4 py-3">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function RowCard({
  row,
  choice,
  onChoose,
}: {
  row: Row;
  choice: Choice;
  onChoose: (value: Choice) => void;
}) {
  const gap = useMemo(() => {
    if (!row.anilist || !row.mal) return null;
    return Math.abs(row.anilist.progress - row.mal.progress);
  }, [row]);

  return (
    <li className="rounded-2xl border border-edge bg-surface/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{row.title}</p>
        {gap && gap > 0 ? (
          <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            {gap} ep gap
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SideOption
          label="AniList"
          side={row.anilist}
          total={row.totalEpisodes}
          selected={choice === "anilist"}
          suggested={row.suggestion === "anilist"}
          onSelect={() => onChoose(choice === "anilist" ? "skip" : "anilist")}
        />
        <SideOption
          label="MyAnimeList"
          side={row.mal}
          total={row.totalEpisodes}
          selected={choice === "mal"}
          suggested={row.suggestion === "mal"}
          onSelect={() => onChoose(choice === "mal" ? "skip" : "mal")}
        />
      </div>

      <p className="mt-2 text-[11px] text-muted">
        {choice === "skip"
          ? "Skipped — nothing will be written."
          : choice === "anilist"
            ? "AniList wins; MyAnimeList will be updated to match."
            : "MyAnimeList wins; AniList will be updated to match."}
      </p>
    </li>
  );
}

function SideOption({
  label,
  side,
  total,
  selected,
  suggested,
  onSelect,
}: {
  label: string;
  side: MirrorSide | null;
  total: number | null;
  selected: boolean;
  suggested: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "rounded-xl border px-3.5 py-3 text-left transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anilist",
        selected
          ? "border-anilist bg-anilist/10"
          : "border-edge hover:border-anilist/50",
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
          {label}
        </span>
        {suggested ? (
          <span className="text-[10px] font-medium text-anilist">
            suggested
          </span>
        ) : null}
      </span>

      {side ? (
        <>
          <span className="mt-1 block text-sm font-semibold tabular-nums">
            {side.progress}
            {total ? ` / ${total}` : ""} ep
          </span>
          <span className="block text-xs text-muted">
            {side.status ?? "unknown status"}
          </span>
        </>
      ) : (
        <span className="mt-1 block text-sm text-muted">Not on this list</span>
      )}
    </button>
  );
}

function Results({
  result,
  onRescan,
}: {
  result: ApplyResult;
  onRescan: () => void;
}) {
  const failures = result.results.filter((r) => !r.ok);

  return (
    <div className="mt-6">
      <p className="text-sm">
        Wrote {result.applied} {result.applied === 1 ? "change" : "changes"}
        {result.failed > 0 ? `, ${result.failed} failed.` : "."}
      </p>

      {failures.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {failures.map((f) => (
            <li key={f.key} className="text-xs text-rose-300">
              {f.title} — {f.error}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5">
        <PrimaryButton onClick={onRescan}>Compare again</PrimaryButton>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full rounded-xl bg-anilist px-5 py-3 text-sm font-semibold text-ink",
        "transition hover:brightness-110 active:translate-y-px",
        "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cream",
        "disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function BulkButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-edge px-3.5 py-1.5 text-xs font-medium text-muted transition hover:border-anilist/60 hover:text-cream"
    >
      {children}
    </button>
  );
}

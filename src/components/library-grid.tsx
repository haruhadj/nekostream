"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AiringBadge } from "@/components/airing-countdown";

import {
  DEFAULT_SORT,
  SORTS,
  isSortKey,
  sortEntries,
  type SortKey,
} from "@/lib/library/sort";

export type LibraryCard = {
  id: string;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImageUrl: string | null;
  progress: number;
  totalEpisodes: number | null;
  lastActivityAt: Date | null;
  anilistAddedAt: Date | null;
  nextAiringAt: Date | null;
  nextAiringEpisode: number | null;
};

const STORAGE_KEY = "nekostream:library-sort";

/**
 * Sorting lives on the client so the choice can persist per-device without a
 * round trip or a user-preferences column. The server renders DEFAULT_SORT,
 * then the stored preference is applied on mount — a stored value that differs
 * reorders the grid once, which is cheaper than blocking paint on localStorage.
 */
export function LibraryGrid({ entries }: { entries: LibraryCard[] }) {
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isSortKey(stored)) setSort(stored);
  }, []);

  function choose(next: SortKey) {
    setSort(next);
    // Private-mode Safari throws on write; the sort still applies for this
    // session, it just won't survive a reload.
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  const sorted = useMemo(() => sortEntries(entries, sort), [entries, sort]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sorted;
    return sorted.filter((entry) =>
      [entry.titleRomaji, entry.titleEnglish]
        .filter((title): title is string => Boolean(title))
        .some((title) => title.toLowerCase().includes(trimmed))
    );
  }, [sorted, query]);

  return (
    <>
      <div className="mt-5 flex items-center gap-2 sm:gap-3">
        <label htmlFor="library-search" className="sr-only">
          Search library
        </label>
        {/* The magnifier sits inside the field so the control reads as one
            pill at phone width, where there is no room for an outside label. */}
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-muted stroke-2"
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m15.6 15.6 4.4 4.4" strokeLinecap="round" />
          </svg>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter your library"
            // 16px on mobile: anything smaller makes iOS Safari zoom the page
            // when the field takes focus.
            className="min-h-11 w-full rounded-full border border-edge bg-surface/60 pl-10 pr-4 text-base placeholder:text-muted focus:border-anilist focus:outline-none sm:min-h-0 sm:py-2.5 sm:text-sm"
          />
        </div>

        <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
          <span className="sr-only sm:not-sr-only">Sort</span>
          <span className="relative">
            <select
              value={sort}
              onChange={(e) => choose(e.target.value as SortKey)}
              aria-label="Sort library"
              className={[
                "min-h-11 appearance-none rounded-full border border-edge bg-surface",
                "pl-4 pr-9 text-xs font-medium text-cream sm:min-h-0 sm:py-1.5 sm:pl-3.5 sm:pr-8",
                "transition hover:border-anilist/60",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anilist",
              ].join(" ")}
            >
              {SORTS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 10 6"
              className="pointer-events-none absolute right-3 top-1/2 h-1.5 w-2.5 -translate-y-1/2 fill-none stroke-current stroke-[1.5]"
            >
              <path d="M1 1l4 4 4-4" strokeLinecap="round" />
            </svg>
          </span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          No titles match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-5">
        {filtered.map((entry) => {
          // Only a known total gives a meaningful bar; ongoing shows with an
          // unknown length would otherwise render a fake full one.
          const ratio =
            entry.totalEpisodes && entry.totalEpisodes > 0
              ? Math.min(entry.progress / entry.totalEpisodes, 1)
              : null;

          return (
            <li key={entry.id}>
              <Link
                href={`/anime/${entry.id}`}
                className="group block transition active:scale-[0.97]"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-edge bg-surface shadow-lg shadow-ink/50 ring-1 ring-inset ring-white/5">
                  {entry.coverImageUrl ? (
                    /* AniList CDN images; a plain img avoids remote-host config
                       for a domain the user can't change. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : null}

                  {/* Scrim so the badge and the progress bar stay legible over
                      whatever the cover art happens to be. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/85 to-transparent"
                  />

                  {entry.nextAiringAt && entry.nextAiringEpisode ? (
                    <AiringBadge
                      episodeNumber={entry.nextAiringEpisode}
                      airingAt={entry.nextAiringAt.toISOString()}
                    />
                  ) : null}

                  {ratio !== null && ratio > 0 ? (
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-1 bg-ink/50"
                    >
                      <div
                        className="h-full bg-anilist"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  ) : null}
                </div>

                <p className="mt-2.5 line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-anilist">
                  {entry.titleEnglish ?? entry.titleRomaji}
                </p>
                <p className="mt-1 text-xs text-muted tabular-nums">
                  {entry.progress}
                  {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""}{" "}
                  watched
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      )}
    </>
  );
}

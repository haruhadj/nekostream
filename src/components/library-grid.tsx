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
      <div className="mt-5 flex items-center gap-3">
        <label htmlFor="library-search" className="sr-only">
          Search library
        </label>
        <input
          id="library-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter your library"
          className="w-full rounded-xl border border-edge bg-surface/60 px-4 py-2.5 text-sm placeholder:text-muted focus:border-anilist focus:outline-none sm:max-w-xs"
        />

        <label className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted">
          <span className="shrink-0">Sort</span>
          <span className="relative">
            <select
              value={sort}
              onChange={(e) => choose(e.target.value as SortKey)}
              className={[
                "appearance-none rounded-full border border-edge bg-surface",
                "py-1.5 pl-3.5 pr-8 text-xs font-medium text-cream",
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
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-5">
        {filtered.map((entry) => (
          <li key={entry.id}>
            <Link href={`/anime/${entry.id}`} className="group block">
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-edge bg-surface">
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

                {entry.nextAiringAt && entry.nextAiringEpisode ? (
                  <AiringBadge
                    episodeNumber={entry.nextAiringEpisode}
                    airingAt={entry.nextAiringAt.toISOString()}
                  />
                ) : null}
              </div>

              <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-anilist">
                {entry.titleEnglish ?? entry.titleRomaji}
              </p>
              <p className="mt-1 text-xs text-muted">
                {entry.progress}
                {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""} watched
              </p>
            </Link>
          </li>
        ))}
      </ul>
      )}
    </>
  );
}

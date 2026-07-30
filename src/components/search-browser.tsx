"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AniListMedia } from "@/lib/anilist/queries";
import { stripHtml } from "@/lib/format";

type AddState = "idle" | "adding" | "added";

export function SearchBrowser({
  initialMedia,
  libraryMediaIds,
}: {
  initialMedia: AniListMedia[];
  /** AniList ids already in the library, so results show the right state */
  libraryMediaIds: number[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [media, setMedia] = useState(initialMedia);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  const [inLibrary, setInLibrary] = useState(() => new Set(libraryMediaIds));
  const [addStates, setAddStates] = useState<Record<number, AddState>>({});
  const [preview, setPreview] = useState<AniListMedia | null>(null);

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      startSearch(async () => {
        setError(null);
        try {
          const res = await fetch(
            `/api/anilist/search?q=${encodeURIComponent(trimmed)}`
          );
          const json = await res.json();
          if (!res.ok) {
            setError(json.error ?? "Search failed.");
            return;
          }
          setMedia(json.media ?? []);
        } catch {
          setError("Search failed. Check your connection.");
        }
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  async function addToLibrary(item: AniListMedia) {
    setAddStates((s) => ({ ...s, [item.id]: "adding" }));

    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anilistMediaId: item.id,
        malMediaId: item.idMal,
        titleRomaji: item.title.romaji,
        titleEnglish: item.title.english,
        coverImageUrl: item.coverImage?.large ?? null,
        totalEpisodes: item.episodes,
      }),
    });

    if (!res.ok) {
      setAddStates((s) => ({ ...s, [item.id]: "idle" }));
      setError("Could not add that title.");
      return;
    }

    setInLibrary((s) => new Set(s).add(item.id));
    setAddStates((s) => ({ ...s, [item.id]: "added" }));
    router.refresh();
  }

  return (
    <div>
      <label htmlFor="anime-search" className="sr-only">
        Search anime
      </label>
      <input
        id="anime-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search anime on AniList"
        className="w-full rounded-xl border border-edge bg-surface/60 px-4 py-3 text-[15px] placeholder:text-muted focus:border-anilist focus:outline-none"
      />

      <p className="mt-3 h-5 text-xs text-muted" aria-live="polite">
        {error ? (
          <span className="text-cream">{error}</span>
        ) : isSearching ? (
          "Searching…"
        ) : query.trim() ? (
          `${media.length} results`
        ) : (
          "Trending now"
        )}
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {media.map((item) => {
          const added = inLibrary.has(item.id);
          const state = addStates[item.id] ?? "idle";

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setPreview(item)}
                className="group block w-full text-left"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-xl border border-edge bg-surface">
                  {item.coverImage?.large ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.coverImage.large}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : null}
                </div>

                <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-anilist">
                  {item.title.english ?? item.title.romaji}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {[item.format, item.seasonYear].filter(Boolean).join(" · ")}
                </p>
              </button>

              <button
                type="button"
                onClick={() => addToLibrary(item)}
                disabled={added || state === "adding"}
                className={[
                  "mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream",
                  added
                    ? "cursor-default border border-edge text-muted"
                    : "bg-anilist text-ink hover:brightness-110 disabled:opacity-60",
                ].join(" ")}
              >
                {added ? "In library" : state === "adding" ? "Adding…" : "Add"}
              </button>
            </li>
          );
        })}
      </ul>

      {media.length === 0 && !isSearching ? (
        <p className="mt-10 text-center text-sm text-muted">
          No anime matched that search.
        </p>
      ) : null}

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-xl flex-col gap-5 overflow-y-auto rounded-2xl border border-edge bg-surface p-6 sm:flex-row"
          >
            <div className="w-32 shrink-0 overflow-hidden rounded-xl border border-edge bg-ink sm:w-40">
              {preview.coverImage?.large ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.coverImage.large}
                  alt=""
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold leading-tight text-balance">
                  {preview.title.english ?? preview.title.romaji}
                </h2>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  aria-label="Close"
                  className="shrink-0 rounded-full p-1 text-muted transition hover:text-cream"
                >
                  ✕
                </button>
              </div>
              {preview.title.english ? (
                <p className="mt-1 text-sm text-muted">{preview.title.romaji}</p>
              ) : null}

              <p className="mt-2 text-xs text-muted">
                {[preview.format, preview.seasonYear, preview.episodes ? `${preview.episodes} ep` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {preview.genres.length > 0 ? (
                <p className="mt-2 text-xs text-muted">{preview.genres.join(" · ")}</p>
              ) : null}

              {preview.description ? (
                <p className="mt-4 line-clamp-[8] text-sm leading-relaxed text-muted">
                  {stripHtml(preview.description)}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => addToLibrary(preview)}
                disabled={
                  inLibrary.has(preview.id) ||
                  (addStates[preview.id] ?? "idle") === "adding"
                }
                className={[
                  "mt-5 w-full rounded-lg px-3 py-2 text-sm font-semibold transition sm:w-auto",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream",
                  inLibrary.has(preview.id)
                    ? "cursor-default border border-edge text-muted"
                    : "bg-anilist text-ink hover:brightness-110 disabled:opacity-60",
                ].join(" ")}
              >
                {inLibrary.has(preview.id)
                  ? "In library"
                  : (addStates[preview.id] ?? "idle") === "adding"
                    ? "Adding…"
                    : "Add to library"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

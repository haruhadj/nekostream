"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { AnimeGrid, AnimePoster, AnimeTitle } from "@/components/ui/anime-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetGrabHandle } from "@/components/ui/sheet";
import { apiRequest, apiSend } from "@/lib/client/request";

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

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      startSearch(async () => {
        setError(null);
        const result = await apiRequest<{ media?: AniListMedia[] }>(
          `/api/anilist/search?q=${encodeURIComponent(trimmed)}`,
          { fallbackError: "Search failed." }
        );

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setMedia(result.data.media ?? []);
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  async function addToLibrary(item: AniListMedia) {
    setAddStates((s) => ({ ...s, [item.id]: "adding" }));

    // Previously an unguarded fetch: a dropped connection threw here instead
    // of leaving the card in a recoverable state.
    const result = await apiSend(
      "/api/library",
      "POST",
      {
        anilistMediaId: item.id,
        malMediaId: item.idMal,
        titleRomaji: item.title.romaji,
        titleEnglish: item.title.english,
        coverImageUrl: item.coverImage?.large ?? null,
        totalEpisodes: item.episodes,
      },
      { fallbackError: "Could not add that title." }
    );

    if (!result.ok) {
      setAddStates((s) => ({ ...s, [item.id]: "idle" }));
      setError(result.error);
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
      <Input
        id="anime-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search anime on AniList"
        className="min-h-12 text-base"
      />

      <p className="mt-3 h-5 text-xs text-muted" aria-live="polite">
        {error ? (
          <span className="text-foreground">{error}</span>
        ) : isSearching ? (
          "Searching…"
        ) : query.trim() ? (
          `${media.length} results`
        ) : (
          "Trending now"
        )}
      </p>

      <AnimeGrid>
        {media.map((item) => {
          const added = inLibrary.has(item.id);
          const state = addStates[item.id] ?? "idle";

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setPreview(item)}
                className="group block w-full text-left transition active:scale-[0.97]"
              >
                <AnimePoster coverImageUrl={item.coverImage?.large}>
                  {added ? (
                    <Badge className="absolute right-2 top-2">In library</Badge>
                  ) : null}
                </AnimePoster>

                <AnimeTitle>
                  {item.title.english ?? item.title.romaji}
                </AnimeTitle>
                <p className="mt-1 text-xs text-muted">
                  {[item.format, item.seasonYear].filter(Boolean).join(" · ")}
                </p>
              </button>

              <Button
                variant={added ? "outline" : "primary"}
                size="sm"
                className="mt-2 w-full"
                onClick={() => addToLibrary(item)}
                disabled={added || state === "adding"}
              >
                {added ? "In library" : state === "adding" ? "Adding…" : "Add"}
              </Button>
            </li>
          );
        })}
      </AnimeGrid>

      {media.length === 0 && !isSearching ? (
        <p className="mt-10 text-center text-sm text-muted">
          No anime matched that search.
        </p>
      ) : null}

      {preview ? (
        // A sheet rising from the bottom edge on phones, a centred dialog once
        // there is room — the same markup, different anchoring.
        <Sheet
          label={preview.title.english ?? preview.title.romaji}
          onClose={() => setPreview(null)}
          panelClassName={[
            "flex w-full max-w-xl flex-col gap-5 overflow-y-auto border border-border bg-surface",
            "max-h-[88vh] rounded-t-xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
            "sm:max-h-[85vh] sm:flex-row sm:rounded-xl sm:p-6 sm:pb-6",
          ].join(" ")}
        >
          <SheetGrabHandle />

          <div className="mx-auto w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-background sm:mx-0 sm:w-40">
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
                className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-background/40 hover:text-foreground"
              >
                <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            {preview.title.english ? (
              <p className="mt-1 text-sm text-muted">{preview.title.romaji}</p>
            ) : null}

            <p className="mt-2 text-xs text-muted">
              {[
                preview.format,
                preview.seasonYear,
                preview.episodes ? `${preview.episodes} ep` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {preview.genres.length > 0 ? (
              <p className="mt-2 text-xs text-muted">
                {preview.genres.join(" · ")}
              </p>
            ) : null}

            {preview.description ? (
              <p className="mt-4 line-clamp-[8] text-sm leading-relaxed text-muted">
                {stripHtml(preview.description)}
              </p>
            ) : null}

            <Button
              variant={inLibrary.has(preview.id) ? "outline" : "primary"}
              className="mt-5 w-full sm:w-auto"
              onClick={() => addToLibrary(preview)}
              disabled={
                inLibrary.has(preview.id) ||
                (addStates[preview.id] ?? "idle") === "adding"
              }
            >
              {inLibrary.has(preview.id)
                ? "In library"
                : (addStates[preview.id] ?? "idle") === "adding"
                  ? "Adding…"
                  : "Add to library"}
            </Button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

/**
 * The poster grid, shared by the library and by search.
 *
 * The two were character-identical in their grid, poster frame and title
 * classes but differed in what they overlay on the art and what they render
 * underneath, so the frame lives here and the differences stay at the call
 * sites as children.
 */

export function AnimeGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-5">
      {children}
    </ul>
  );
}

/**
 * The 2:3 cover frame. `children` are overlays positioned against it — the
 * airing badge, the progress bar, the "In library" pill.
 */
export function AnimePoster({
  coverImageUrl,
  children,
}: {
  coverImageUrl: string | null | undefined;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-edge bg-surface shadow-lg shadow-ink/50 ring-1 ring-inset ring-white/5">
      {coverImageUrl ? (
        /* AniList CDN images; a plain img avoids remote-host config for a
           domain the user cannot change. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : null}

      {children}
    </div>
  );
}

export function AnimeTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2.5 line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-anilist">
      {children}
    </p>
  );
}

/** Darkens the foot of the art so overlaid text stays legible. */
export function PosterScrim() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/85 to-transparent"
    />
  );
}

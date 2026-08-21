import { ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  anilistAnimeUrl,
  malAnimeUrl,
  PROVIDER_LABEL,
} from "@/lib/providers";

/**
 * Official marks, path data from simple-icons (CC0). Decorative — the text
 * label beside each one already names the tracker.
 */
function AniListLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 text-[#02A9FF]"
    >
      <path d="M24 17.53v2.421c0 .71-.391 1.101-1.1 1.101h-5l-.057-.165L11.84 3.736c.106-.502.46-.788 1.053-.788h2.422c.71 0 1.1.391 1.1 1.1v12.38H22.9c.71 0 1.1.392 1.1 1.101zM11.034 2.947l6.337 18.104h-4.918l-1.052-3.131H6.019l-1.077 3.131H0L6.361 2.948h4.673zm-.66 10.96-1.69-5.014-1.541 5.015h3.23z" />
    </svg>
  );
}

function MyAnimeListLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 text-[#5C7EDB]"
    >
      <path d="M14.921 6.479c-.82 0-3.683 0-4.947 3.156-.662 1.652-.986 4.812.876 7.886l1.934-1.41s-.767-1.095-1.083-3.191h2.897l.022 3.19h2.604V8.835h-2.581v2.043l-2.46-.023s.413-2.408 2.877-2.336h2.454l-.572-2.04ZM0 6.528v9.624h2.348v-5.84l2.031 2.664 2.047-2.652v5.828h2.336V6.528H6.437L4.368 9.474 2.31 6.528Zm18.447.022v9.583h5.022L24 14.09h-3.232V6.55Z" />
    </svg>
  );
}

function TrackerLink({
  href,
  label,
  logo,
  brandClassName,
}: {
  href: string;
  label: string;
  logo: React.ReactNode;
  brandClassName: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={buttonVariants({
        variant: "outline",
        size: "sm",
        className: cn("text-foreground", brandClassName),
      })}
    >
      {logo}
      {label}
      <ExternalLink
        aria-hidden="true"
        className="h-3 w-3 opacity-50"
        strokeWidth={2}
      />
    </a>
  );
}

/**
 * Out to each tracker's own page for the show. MAL's navy (#2E51A2) is too
 * dark to read against a zinc-950 surface, so its mark and border use a
 * lightened tint of it; AniList's blue needs no help.
 */
export function TrackerLinks({
  anilistMediaId,
  malMediaId,
}: {
  anilistMediaId: number;
  malMediaId: number | null;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <TrackerLink
        href={anilistAnimeUrl(anilistMediaId)}
        label={PROVIDER_LABEL.anilist}
        logo={<AniListLogo />}
        brandClassName="border-[#02A9FF]/40 bg-[#02A9FF]/10 hover:border-[#02A9FF]/70 hover:bg-[#02A9FF]/20"
      />
      {malMediaId !== null ? (
        <TrackerLink
          href={malAnimeUrl(malMediaId)}
          label={PROVIDER_LABEL.mal}
          logo={<MyAnimeListLogo />}
          brandClassName="border-[#5C7EDB]/40 bg-[#5C7EDB]/10 hover:border-[#5C7EDB]/70 hover:bg-[#5C7EDB]/20"
        />
      ) : null}
    </div>
  );
}

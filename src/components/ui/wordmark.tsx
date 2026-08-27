import Image from "next/image";

/** The brand mark: the cat-and-play glyph next to the name, used at header
 * size in SiteHeader and as a standalone eyebrow on the login page. */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
      <Image
        src="/logo.png"
        alt=""
        aria-hidden="true"
        width={512}
        height={512}
        priority
        className="h-6 w-6"
      />
      Neko<span className="text-accent">Stream</span>
    </span>
  );
}

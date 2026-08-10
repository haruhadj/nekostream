/** The brand mark: a static dot next to the name, used at header size in
 * SiteHeader and as a standalone eyebrow on the login page. */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
      Neko<span className="text-accent">Stream</span>
    </span>
  );
}

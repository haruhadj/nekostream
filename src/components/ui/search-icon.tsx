/**
 * The magnifier, drawn once.
 *
 * Two shapes rather than one component because the header renders it into a
 * generic icon slot that supplies its own svg element and stroke weight, while
 * the library filter needs a standalone icon.
 */
export function SearchIconPaths() {
  return (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.6 15.6 4.4 4.4" strokeLinecap="round" />
    </>
  );
}

export function SearchIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <SearchIconPaths />
    </svg>
  );
}

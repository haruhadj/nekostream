import Link from "next/link";

import { SearchIconPaths } from "@/components/ui/search-icon";

type Tab = "library" | "search" | "settings";

/**
 * Two navigations for one set of destinations. Wide screens get the usual top
 * bar; phones get a thumb-reachable tab bar pinned to the bottom, which is
 * where a hand actually is on a 6" screen. Only one is ever visible.
 */
export function SiteHeader({ active }: { active?: Tab }) {
  return (
    <>
      <header className="glass sticky top-0 z-40 border-b border-edge/70 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3.5 sm:px-6 sm:py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cream"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-anilist shadow-[0_0_12px_var(--anilist)]"
            />
            NekoStream
          </Link>

          {/* The top links duplicate the tab bar, so they stand down on phones. */}
          <nav className="hidden items-center gap-5 text-sm sm:flex">
            <NavLink href="/" label="Library" isActive={active === "library"} />
            <NavLink
              href="/search"
              label="Search"
              isActive={active === "search"}
            />
          </nav>

          <Link
            href="/settings"
            className="ml-auto hidden text-sm text-muted transition-colors hover:text-cream sm:block"
          >
            Settings
          </Link>
        </div>
      </header>

      <TabBar active={active} />
    </>
  );
}

function NavLink({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        isActive
          ? "text-cream underline decoration-anilist decoration-2 underline-offset-8"
          : "text-muted transition-colors hover:text-cream"
      }
    >
      {label}
    </Link>
  );
}

function TabBar({ active }: { active?: Tab }) {
  return (
    <nav
      aria-label="Primary"
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-edge/70 pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex h-[var(--tabbar)] items-stretch">
        <TabLink href="/" label="Library" isActive={active === "library"}>
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h3A1.5 1.5 0 0 1 10 5.5v13A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-13ZM13 5.5A1.5 1.5 0 0 1 14.5 4h1A1.5 1.5 0 0 1 17 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v-13Z" />
        </TabLink>

        <TabLink href="/search" label="Search" isActive={active === "search"}>
          <SearchIconPaths />
        </TabLink>

        <TabLink
          href="/settings"
          label="Settings"
          isActive={active === "settings"}
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6"
            strokeLinecap="round"
          />
        </TabLink>
      </ul>
    </nav>
  );
}

function TabLink({
  href,
  label,
  isActive,
  children,
}: {
  href: string;
  label: string;
  isActive?: boolean;
  /** The paths of a 24×24 icon, drawn as strokes by the wrapper. */
  children: React.ReactNode;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={[
          "flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium",
          "transition-colors active:bg-surface/50",
          isActive ? "text-cream" : "text-muted",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-7 w-14 items-center justify-center rounded-full transition-colors",
            isActive ? "bg-anilist/15 text-anilist" : "",
          ].join(" ")}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 fill-none stroke-current stroke-[1.75]"
          >
            {children}
          </svg>
        </span>
        {label}
      </Link>
    </li>
  );
}

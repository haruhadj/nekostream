import Link from "next/link";
import { CalendarDays, LibraryBig, Search, Settings } from "lucide-react";

import { Wordmark } from "@/components/ui/wordmark";
import { cn } from "@/lib/cn";

type Tab = "library" | "calendar" | "search" | "settings";

/**
 * Two navigations for one set of destinations. Wide screens get the usual top
 * bar; phones get a thumb-reachable tab bar pinned to the bottom, which is
 * where a hand actually is on a 6" screen. Only one is ever visible.
 */
export function SiteHeader({ active }: { active?: Tab }) {
  return (
    <>
      <header className="glass sticky top-0 z-40 border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3.5 sm:px-6 sm:py-4">
          <Link href="/">
            <Wordmark />
          </Link>

          {/* The top links duplicate the tab bar, so they stand down on phones. */}
          <nav className="hidden items-center gap-5 text-sm sm:flex">
            <NavLink href="/" label="Library" isActive={active === "library"} />
            <NavLink
              href="/calendar"
              label="Calendar"
              isActive={active === "calendar"}
            />
            <NavLink
              href="/search"
              label="Search"
              isActive={active === "search"}
            />
          </nav>

          <Link
            href="/settings"
            className="ml-auto hidden text-sm text-muted transition-colors hover:text-foreground sm:block"
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
          ? "text-foreground underline decoration-accent decoration-2 underline-offset-8"
          : "text-muted transition-colors hover:text-foreground"
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
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex h-[var(--tabbar)] items-stretch">
        <TabLink href="/" label="Library" isActive={active === "library"}>
          <LibraryBig aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
        </TabLink>

        <TabLink
          href="/calendar"
          label="Calendar"
          isActive={active === "calendar"}
        >
          <CalendarDays
            aria-hidden="true"
            className="h-5 w-5"
            strokeWidth={1.75}
          />
        </TabLink>

        <TabLink href="/search" label="Search" isActive={active === "search"}>
          <Search aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
        </TabLink>

        <TabLink
          href="/settings"
          label="Settings"
          isActive={active === "settings"}
        >
          <Settings aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
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
  /** A pre-rendered Lucide icon. */
  children: React.ReactNode;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium",
          "transition-colors active:bg-surface/50",
          isActive ? "text-foreground" : "text-muted"
        )}
      >
        <span
          className={cn(
            "flex h-7 w-14 items-center justify-center rounded-full transition-colors",
            isActive ? "bg-accent/15 text-accent" : ""
          )}
        >
          {children}
        </span>
        {label}
      </Link>
    </li>
  );
}

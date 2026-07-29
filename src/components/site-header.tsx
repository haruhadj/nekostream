import Link from "next/link";

export function SiteHeader({ active }: { active?: "library" | "search" }) {
  return (
    <header className="border-b border-edge">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-6 py-4">
        <Link
          href="/"
          className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cream"
        >
          NekoStream
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          <NavLink href="/" label="Library" isActive={active === "library"} />
          <NavLink href="/search" label="Search" isActive={active === "search"} />
        </nav>

        <Link
          href="/settings"
          className="ml-auto text-sm text-muted transition-colors hover:text-cream"
        >
          Settings
        </Link>
      </div>
    </header>
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

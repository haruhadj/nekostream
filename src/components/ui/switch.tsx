import { cn } from "@/lib/cn";

/**
 * The track/thumb glyph only — presentational, not the interactive element.
 * Every call site wraps this in its own `role="switch"` button, because the
 * whole descriptive row (icon, label, helper text) is the tap target on
 * mobile, not just this glyph. Keeping the accessible element at the call
 * site means this component never has to guess how big that row is.
 */
export function Switch({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
        checked ? "bg-accent" : "bg-border",
        className
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </span>
  );
}

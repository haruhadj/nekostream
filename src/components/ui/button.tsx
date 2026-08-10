import { forwardRef } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "default" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-border/60",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-surface",
  ghost: "bg-transparent text-muted hover:bg-surface hover:text-foreground",
  destructive: "bg-transparent text-rose-400 hover:bg-rose-400/10",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 rounded-lg px-3.5 text-xs",
  default: "min-h-11 rounded-lg px-4 text-sm sm:min-h-9 sm:py-0",
  lg: "min-h-12 rounded-lg px-6 text-sm",
  icon: "h-10 w-10 shrink-0 rounded-full p-0",
};

/**
 * The class list alone, for elements that can't be a `<button>` — an
 * external link styled as a primary action, a `next/link` navigating to
 * another route. Keeps every actionable element on the same variant/size
 * scale as `Button` without forcing a `role="button"` div into the DOM.
 */
export function buttonVariants({
  variant = "primary",
  size = "default",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-medium transition-colors",
    "active:scale-[0.97] focus-ring disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
);
Button.displayName = "Button";

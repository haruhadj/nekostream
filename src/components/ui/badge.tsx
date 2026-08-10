import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "success" | "warning";

const variantClasses: Record<Variant, string> = {
  default: "bg-accent/15 text-accent",
  outline: "border border-border text-muted",
  success: "bg-emerald-500/15 text-emerald-400",
  warning: "bg-amber-400/15 text-amber-300",
};

export function Badge({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

import { forwardRef } from "react";

import { cn } from "@/lib/cn";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "min-h-11 w-full rounded-lg border border-border bg-background px-3.5 text-sm text-foreground",
      "placeholder:text-muted transition-colors focus:border-accent focus:outline-none sm:min-h-9 sm:py-2",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

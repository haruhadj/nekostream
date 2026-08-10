import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combines conditional classes and resolves Tailwind conflicts in favour of
 * whichever one comes last — lets a caller override a primitive's default
 * classes (e.g. `<Button className="w-full">`) without a specificity fight. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

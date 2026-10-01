import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui's class combiner: conditional classes, later Tailwind classes win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type ClassValue = string | number | false | null | undefined;

/**
 * Minimal className joiner for the Wexon UI kit.
 * Filters out falsy values so conditional classes read cleanly:
 *   cn("base", active && "is-active", disabled ? "opacity-50" : undefined)
 * Intentionally dependency-free (no clsx / tailwind-merge) to keep the kit lightweight.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

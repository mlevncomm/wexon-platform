import type { ProductAccent } from "@/types/wexon";

interface AccentClasses {
  /** Soft chip / badge background + text + border. */
  soft: string;
  /** Solid icon tile background + text. */
  solid: string;
  /** Text-only accent color. */
  text: string;
  /** Small status dot background. */
  dot: string;
  /** Ring/border on hover for cards. */
  hoverBorder: string;
}

export const ACCENT_CLASSES: Record<ProductAccent, AccentClasses> = {
  emerald: {
    soft: "border-emerald-200 bg-emerald-50 text-emerald-700",
    solid: "bg-emerald-500 text-white",
    text: "text-emerald-600",
    dot: "bg-emerald-500",
    hoverBorder: "hover:border-emerald-300 hover:shadow-emerald-100/60",
  },
  indigo: {
    soft: "border-indigo-200 bg-indigo-50 text-indigo-700",
    solid: "bg-indigo-500 text-white",
    text: "text-indigo-600",
    dot: "bg-indigo-500",
    hoverBorder: "hover:border-indigo-300 hover:shadow-indigo-100/60",
  },
  amber: {
    soft: "border-amber-200 bg-amber-50 text-amber-800",
    solid: "bg-amber-500 text-white",
    text: "text-amber-700",
    dot: "bg-amber-500",
    hoverBorder: "hover:border-amber-300 hover:shadow-amber-100/60",
  },
};

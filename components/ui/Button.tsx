import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { WexonIcon } from "@/components/marketing/home/icons";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "onDark"
  | "onDarkGhost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "wx-tactile inline-flex items-center justify-center gap-2 rounded-full font-bold tracking-[-0.01em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55";

const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 text-[0.8125rem]",
  md: "min-h-12 px-6 text-sm",
  lg: "min-h-[3.35rem] px-8 text-base",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-500 text-white shadow-[0_18px_42px_-16px_rgba(16,185,129,0.75)] hover:bg-emerald-600",
  secondary:
    "border border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:text-emerald-700",
  ghost: "text-slate-700 hover:bg-slate-100",
  onDark: "bg-white text-slate-950 hover:bg-emerald-50 focus-visible:ring-offset-transparent",
  onDarkGhost:
    "border border-white/15 bg-white/5 text-white backdrop-blur hover:bg-white/10 focus-visible:ring-offset-transparent",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  withArrow?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

interface ButtonAsLink extends CommonProps {
  href: string;
  target?: string;
  rel?: string;
  prefetch?: boolean;
}

interface ButtonAsButton extends CommonProps {
  href?: undefined;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
}

export type ButtonProps = ButtonAsLink | ButtonAsButton;

function Content({ children, withArrow }: { children: ReactNode; withArrow?: boolean }) {
  return (
    <>
      {children}
      {withArrow && (
        <WexonIcon
          name="arrowRight"
          size={17}
          strokeWidth={2.4}
          className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
        />
      )}
    </>
  );
}

export default function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    withArrow = false,
    fullWidth = false,
    className,
    children,
  } = props;

  const classes = cn(
    "group/btn",
    BASE,
    SIZE[size],
    VARIANT[variant],
    fullWidth ? "w-full" : "",
    className,
  );

  if (props.href !== undefined) {
    return (
      <Link
        href={props.href}
        target={props.target}
        rel={props.rel}
        prefetch={props.prefetch}
        className={classes}
      >
        <Content withArrow={withArrow}>{children}</Content>
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={classes}
    >
      <Content withArrow={withArrow}>{children}</Content>
    </button>
  );
}

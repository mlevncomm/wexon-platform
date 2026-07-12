import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PhoneFrameProps {
  children: ReactNode;
  /** Status bar time label. */
  time?: string;
  className?: string;
}

/** Realistic phone bezel with notch + status bar; children render inside the screen. */
export default function PhoneFrame({ children, time = "9:41", className }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[19rem] rounded-[2.75rem] border border-slate-900/10 bg-slate-950 p-2.5 shadow-[0_40px_90px_-40px_rgba(2,44,34,0.55)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[2.25rem] bg-white">
        {/* notch */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-950" />
        {/* status bar */}
        <div className="flex items-center justify-between px-6 pb-1 pt-2.5 text-[0.7rem] font-bold text-slate-900">
          <span>{time}</span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="inline-block h-2.5 w-4 rounded-[3px] border border-slate-300" />
          </span>
        </div>
        <div className="px-3 pb-4">{children}</div>
      </div>
    </div>
  );
}

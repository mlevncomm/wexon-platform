"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

function subscribeNoop() {
  return () => {};
}

type MenuCoords = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

/**
 * Compact overflow / popup action menu for cards and table rows.
 * Renders via portal so table overflow never clips or scrolls the menu.
 */
export function AdminActionMenu({
  label = "İşlemler",
  ariaLabel,
  align = "right",
  widthClassName = "w-[min(100vw-1.5rem,20rem)]",
  children,
}: {
  label?: string;
  ariaLabel?: string;
  align?: "left" | "right";
  widthClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const viewportPadding = 12;
      const menuWidth = Math.min(window.innerWidth - viewportPadding * 2, 320);
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, Math.min(openUp ? spaceAbove - 8 : spaceBelow - 8, 420));

      let left = align === "right" ? rect.right - menuWidth : rect.left;
      left = Math.min(Math.max(viewportPadding, left), window.innerWidth - menuWidth - viewportPadding);

      setCoords({
        top: openUp ? undefined : rect.bottom + 8,
        bottom: openUp ? window.innerHeight - rect.top + 8 : undefined,
        left,
        width: menuWidth,
        maxHeight,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu =
    open && mounted && coords ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        style={{
          position: "fixed",
          top: coords.top,
          bottom: coords.bottom,
          left: coords.left,
          width: coords.width,
          maxHeight: coords.maxHeight,
          zIndex: 80,
        }}
        className={`overflow-y-auto overscroll-contain rounded-[12px] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/15 ${widthClassName}`}
      >
        <div className="space-y-3">{children}</div>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={ariaLabel ?? label}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${
          open ? "border-emerald-300 ring-4 ring-emerald-100" : ""
        }`}
      >
        <span className="hidden sm:inline">{label}</span>
        <span className="text-base leading-none" aria-hidden>
          ⋯
        </span>
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

export function AdminActionMenuSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      {title ? (
        <p className="px-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{title}</p>
      ) : null}
      {children}
    </div>
  );
}

export function AdminActionMenuHint({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold leading-relaxed text-slate-500">{children}</p>;
}

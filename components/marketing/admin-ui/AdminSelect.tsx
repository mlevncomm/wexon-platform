"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ADMIN_FIELD_SURFACE } from "@/components/marketing/admin-ui/adminFieldStyles";

function subscribeNoop() {
  return () => {};
}

export type AdminSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MenuCoords = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

/**
 * Accessible combobox for admin forms/filters.
 * Native `<select>` stays in the form for required validation + submit values.
 */
export function AdminSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Seçin",
  required = false,
  disabled = false,
  compact = false,
  className = "",
  "aria-label": ariaLabel,
}: {
  name: string;
  options: AdminSelectOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionIdPrefix = useId();

  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setValue(defaultValue);
  }

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options],
  );

  const activeOption = enabledOptions[activeIndex] ?? null;
  const activeDescendantId = activeOption
    ? `${optionIdPrefix}-opt-${enabledOptions.findIndex((item) => item.value === activeOption.value)}`
    : undefined;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const viewportPadding = 12;
      const menuWidth = Math.min(Math.max(rect.width, 220), window.innerWidth - viewportPadding * 2);
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, Math.min(openUp ? spaceAbove - 8 : spaceBelow - 8, 360));
      let left = rect.left;
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
    const selectedIndex = Math.max(
      0,
      enabledOptions.findIndex((option) => option.value === value),
    );
    setActiveIndex(selectedIndex);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, enabledOptions, value]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(Math.max(0, enabledOptions.length - 1));
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(enabledOptions.length - 1, index + 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const option = enabledOptions[activeIndex];
        if (!option) return;
        setValue(option.value);
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, activeIndex, enabledOptions]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const active = menuRef.current.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function closeAndRestoreFocus() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  const menu =
    open && mounted && coords ? (
      <div
        ref={menuRef}
        id={listId}
        role="listbox"
        aria-label={ariaLabel ?? placeholder}
        tabIndex={-1}
        style={{
          position: "fixed",
          top: coords.top,
          bottom: coords.bottom,
          left: coords.left,
          width: coords.width,
          maxHeight: coords.maxHeight,
          zIndex: 90,
        }}
        className="overflow-y-auto overscroll-contain rounded-[14px] border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15"
      >
        {options.length === 0 ? (
          <p className="px-3 py-2.5 text-sm font-semibold text-slate-500">Seçenek yok</p>
        ) : (
          options.map((option) => {
            const isSelected = option.value === value;
            const enabledIndex = enabledOptions.findIndex((item) => item.value === option.value);
            const isActive = !option.disabled && enabledIndex === activeIndex;
            const optionId =
              enabledIndex >= 0 ? `${optionIdPrefix}-opt-${enabledIndex}` : `${optionIdPrefix}-disabled-${option.value}`;
            return (
              <div
                key={`${option.value}::${option.label}`}
                id={optionId}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                data-active={isActive ? "true" : undefined}
                onMouseEnter={() => {
                  if (!option.disabled && enabledIndex >= 0) setActiveIndex(enabledIndex);
                }}
                onClick={() => {
                  if (option.disabled) return;
                  setValue(option.value);
                  closeAndRestoreFocus();
                }}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm font-semibold transition ${
                  option.disabled
                    ? "cursor-not-allowed text-slate-300"
                    : isSelected
                      ? "bg-slate-950 text-emerald-300"
                      : isActive
                        ? "bg-slate-50 text-slate-950"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isSelected ? (
                  <span className="shrink-0 text-[11px] font-black tracking-wide text-emerald-300" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <select
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={`${option.value}::${option.label}`} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? activeDescendantId : undefined}
        aria-label={ariaLabel ?? placeholder}
        aria-required={required || undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        className={`flex w-full min-w-0 items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
          compact
            ? "min-h-10 rounded-[10px] px-3 text-xs font-bold"
            : "mt-2 min-h-11 rounded-[10px] px-3.5 text-sm font-semibold"
        } ${
          open
            ? "border border-emerald-500 bg-white shadow-[0_0_0_4px_rgba(16,185,129,0.14)] outline-none"
            : ADMIN_FIELD_SURFACE
        }`}
      >
        <span className={`min-w-0 truncate ${selected ? "text-slate-950" : "text-slate-400"}`}>
          {selected?.label ?? placeholder}
        </span>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-600 transition ${
            open ? "rotate-180 bg-slate-950 text-emerald-300" : ""
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

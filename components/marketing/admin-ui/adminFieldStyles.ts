/** Shared admin field chrome — hover/focus for inputs, textareas, and select triggers. */
export const ADMIN_FIELD_SURFACE =
  "border border-slate-200 bg-white outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-sm hover:shadow-slate-200/50 focus:border-emerald-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(16,185,129,0.14)] focus:ring-0";

export const ADMIN_FIELD_CONTROL = `mt-2 min-h-11 w-full min-w-0 rounded-[10px] px-3.5 text-sm font-semibold text-slate-950 ${ADMIN_FIELD_SURFACE}`;

export const ADMIN_FIELD_CONTROL_COMPACT = `min-h-10 w-full min-w-0 rounded-[10px] px-3 text-xs font-semibold text-slate-700 ${ADMIN_FIELD_SURFACE}`;

export const ADMIN_FIELD_TEXTAREA = `mt-2 min-h-24 w-full min-w-0 rounded-[10px] px-3.5 py-3 text-sm font-semibold text-slate-950 ${ADMIN_FIELD_SURFACE}`;

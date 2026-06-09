"use client";

import { useState } from "react";

export default function LoginPasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Şifre</span>
      <div className="mt-2 flex min-w-0 items-center rounded-2xl border border-slate-200 bg-white focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100">
        <input
          name="password"
          type={visible ? "text" : "password"}
          required
          className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3 text-sm font-semibold outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
          className="mr-2 shrink-0 rounded-xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
        >
          {visible ? "Gizle" : "Göster"}
        </button>
      </div>
    </label>
  );
}

"use client";

import { useState } from "react";

function PasswordField({ label, name }: { label: string; name: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block min-w-0">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <div className="mt-2 flex min-w-0 items-center rounded-2xl border border-slate-200 bg-white focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? `${label} gizle` : `${label} göster`}
          className="mr-2 shrink-0 rounded-xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
        >
          {visible ? "Gizle" : "Göster"}
        </button>
      </div>
    </label>
  );
}

export default function ChangePasswordFields() {
  return (
    <>
      <PasswordField label="Mevcut şifre" name="currentPassword" />
      <PasswordField label="Yeni şifre" name="newPassword" />
      <PasswordField label="Yeni şifre tekrar" name="newPasswordConfirm" />
    </>
  );
}

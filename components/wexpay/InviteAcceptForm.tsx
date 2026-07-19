"use client";

import { useActionState } from "react";
import { acceptStaffInviteAction, type InviteAcceptState } from "@/lib/wexpay-staff-invite-actions";
import type { MembershipRole } from ".prisma/client";

const initial: InviteAcceptState = { ok: false };

export function InviteAcceptForm({
  token,
  organizationName,
  email,
  role,
}: {
  token: string;
  organizationName: string;
  email: string;
  role: MembershipRole;
}) {
  const [state, action, pending] = useActionState(acceptStaffInviteAction, initial);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Wexon</p>
      <h1 className="mt-2 text-xl font-black text-slate-950">Personel daveti</h1>
      <p className="mt-2 text-sm font-medium text-slate-600">
        <strong>{organizationName}</strong> sizi <strong>{role}</strong> olarak davet etti.
      </p>
      <form action={action} className="mt-5 space-y-3">
        <input type="hidden" name="token" value={token} />
        <label className="block text-sm font-semibold text-slate-700">
          E-posta
          <input
            name="email"
            type="email"
            required
            defaultValue={email}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Ad soyad (yeni hesap)
          <input name="name" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Şifre (yeni hesap veya şifresiz hesap)
          <input
            name="password"
            type="password"
            minLength={8}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <p className="text-xs text-slate-500">
          Mevcut hesabınız varsa şifreniz değişmez; yalnızca organizasyona bağlanırsınız.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "Kabul ediliyor…" : "Daveti kabul et"}
        </button>
        {state.error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

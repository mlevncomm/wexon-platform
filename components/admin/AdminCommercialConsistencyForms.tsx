"use client";

import { useMemo, useState, type ReactNode } from "react";

type PlanOption = {
  id: string;
  name: string;
  tierKey: string | null;
  key: string;
};

const TIER_ORDER: Record<string, number> = {
  essential: 1,
  growth: 2,
  scale: 3,
  business_suite: 4,
};

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "mt-2 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

function resolveTier(raw: string | null | undefined) {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/^wexpay_/, "");
  return key in TIER_ORDER ? key : null;
}

function classify(before: string | null, after: string | null) {
  const b = resolveTier(before);
  const a = resolveTier(after);
  if (!b || !a || TIER_ORDER[b] === TIER_ORDER[a]) return "Yatay değişiklik";
  if (TIER_ORDER[a] > TIER_ORDER[b]) return "Yükseltme";
  return "Düşürme";
}

export function AdminLicensePlanChangeForm(props: {
  organizationId: string;
  licenseId: string;
  currentPlanId: string;
  currentTierKey: string | null;
  currentPlanKey: string;
  plans: PlanOption[];
  action: (organizationId: string, licenseId: string, formData: FormData) => Promise<void>;
}) {
  const [planId, setPlanId] = useState(props.currentPlanId);
  const [confirmed, setConfirmed] = useState(false);
  const selected = props.plans.find((p) => p.id === planId) ?? null;
  const changeLabel = useMemo(
    () => classify(props.currentTierKey ?? props.currentPlanKey, selected?.tierKey ?? selected?.key ?? null),
    [selected, props.currentTierKey, props.currentPlanKey],
  );

  return (
    <form action={props.action.bind(null, props.organizationId, props.licenseId)} className="grid gap-4">
      <input type="hidden" name="returnTo" value={`/admin/organizations/${props.organizationId}`} />
      <FieldShell label="Hedef paket">
        <select name="planId" value={planId} onChange={(event) => setPlanId(event.target.value)} className={inputClass}>
          {props.plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </FieldShell>
      <p className="text-sm font-semibold text-slate-600" data-testid="plan-change-type">
        Değişiklik türü: <span className="text-slate-950">{changeLabel}</span>
      </p>
      <FieldShell label="İşlem gerekçesi">
        <input name="reason" required placeholder="Paket değişikliği gerekçesini yazın" className={inputClass} />
      </FieldShell>
      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input
          type="checkbox"
          name="confirmed"
          value="1"
          className="mt-1 h-4 w-4 rounded border-slate-300"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span className="text-sm font-semibold text-slate-700">
          Lisans ve bağlı abonelik paketinin güncelleneceğini, limit aşımlarında işlemin reddedileceğini onaylıyorum.
        </span>
      </label>
      <button
        type="submit"
        disabled={!confirmed || planId === props.currentPlanId}
        className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="plan-change-submit"
      >
        Paketi güncelle
      </button>
    </form>
  );
}

export function AdminActivationFeeWaiveForm(props: {
  organizationId: string;
  productId: string;
  action: (organizationId: string, formData: FormData) => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form action={props.action.bind(null, props.organizationId)} className="grid gap-4" data-testid="activation-fee-waive-form">
      <input type="hidden" name="returnTo" value={`/admin/organizations/${props.organizationId}`} />
      <input type="hidden" name="productId" value={props.productId} />
      <FieldShell label="Muafiyet gerekçesi">
        <input name="reason" required placeholder="Neden muaf tutulduğunu yazın" className={inputClass} />
      </FieldShell>
      <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <input
          type="checkbox"
          name="confirmed"
          value="1"
          className="mt-1 h-4 w-4 rounded border-amber-300"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span className="text-sm font-semibold text-amber-950">
          Aktivasyon ücretinin kalıcı olarak muaf tutulacağını ve bu işlemin geri alınamayacağını onaylıyorum.
        </span>
      </label>
      <button
        type="submit"
        disabled={!confirmed}
        className="inline-flex items-center justify-center rounded-2xl bg-amber-700 px-5 py-3 text-sm font-black text-white transition enabled:hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="activation-fee-waive-submit"
      >
        Aktivasyon ücretinden muaf tut
      </button>
    </form>
  );
}

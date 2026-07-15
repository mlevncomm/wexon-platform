import Link from "next/link";
import type { ReactNode } from "react";

/** Human-readable admin audit action labels — never expose raw secrets. */
const ACTION_LABELS: Record<string, string> = {
  "customer.support_ticket.created": "Destek talebi oluşturuldu",
  "public.demo_request.created": "Public demo / ön başvuru alındı",
  "public.demo_request.status_updated": "Lead durumu güncellendi",
  "public.demo_request.followup_updated": "Lead takip bilgisi güncellendi",
  "admin.organization.created": "Organizasyon oluşturuldu",
  "admin.organization.updated": "Organizasyon güncellendi",
  "admin.organization.deactivated": "Organizasyon pasife alındı",
  "admin.organization.reactivated": "Organizasyon yeniden aktifleştirildi",
  "admin.license.created": "Lisans oluşturuldu",
  "admin.license.status_changed": "Lisans durumu değişti",
  "admin.license.plan_changed": "Lisans planı değişti",
  "admin.plan.created": "Plan oluşturuldu",
  "admin.plan.updated": "Plan güncellendi",
  "admin.product.created": "Ürün oluşturuldu",
  "admin.product.updated": "Ürün güncellendi",
  "admin.subscription.created": "Abonelik oluşturuldu",
  "admin.subscription.status_changed": "Abonelik durumu değişti",
  "admin.invoice.created": "Fatura oluşturuldu",
  "admin.invoice.status_changed": "Fatura durumu değişti",
  "admin.user.password_reset": "Kullanıcı şifresi sıfırlandı",
  "admin.user.active_toggled": "Kullanıcı aktiflik durumu değişti",
  "admin.membership.added": "Üyelik eklendi",
  "admin.wexpay.access_enabled": "WexPay erişimi açıldı",
  "admin.wexpay.access_updated": "WexPay erişim durumu güncellendi",
  "admin.entitlement.upserted": "Entitlement kaydı güncellendi",
};

export function formatAdminAuditAction(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action
    .replace(/^admin\./, "")
    .replace(/^public\./, "")
    .replace(/^customer\./, "")
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminKeyValueList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-slate-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminActivityTimeline({
  items,
}: {
  items: Array<{ id: string; title: string; meta?: string; href?: string }>;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4 text-sm font-semibold text-slate-500">
        Henüz aktivite kaydı bulunmuyor.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          {item.href ? (
            <Link href={item.href} className="text-sm font-black text-slate-950 hover:text-emerald-700">
              {item.title}
            </Link>
          ) : (
            <p className="text-sm font-black text-slate-950">{item.title}</p>
          )}
          {item.meta ? <p className="mt-1 text-xs font-semibold text-slate-500">{item.meta}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function AdminResultCount({
  shown,
  total,
  filtered = false,
}: {
  shown: number;
  total: number;
  filtered?: boolean;
}) {
  return (
    <p className="text-xs font-semibold text-slate-500">
      {filtered ? `${shown} / ${total} kayıt gösteriliyor (filtrelenmiş)` : `${shown} kayıt gösteriliyor`}
    </p>
  );
}

export function AdminSoftNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      {children}
    </div>
  );
}

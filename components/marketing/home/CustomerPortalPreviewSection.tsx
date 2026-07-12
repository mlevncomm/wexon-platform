import Link from "next/link";
import type { CustomerProductCard } from "@/types/wexon";
import {
  CUSTOMER_BILLING,
  CUSTOMER_PRODUCTS,
  CUSTOMER_TEAM,
  PORTAL_NAV_ITEMS,
} from "@/lib/wexon-home-content";
import SectionShell from "@/components/ui/SectionShell";
import Button from "@/components/ui/Button";
import { ACCENT_CLASSES } from "./accent";
import SectionHeading from "./SectionHeading";
import StatusBadge from "./StatusBadge";
import { WexonIcon } from "./icons";

function ProductTile({ product }: { product: CustomerProductCard }) {
  const accent = ACCENT_CLASSES[product.accent];
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-black tracking-tight text-slate-950">{product.name}</p>
        <StatusBadge badge={product.licenseStatus} dot />
      </div>
      <dl className="mt-3 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="font-medium text-slate-400">Yenileme</dt>
          <dd className="font-semibold text-slate-700">{product.renewalDate}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="font-medium text-slate-400">Kullanıcı</dt>
          <dd className="font-semibold text-slate-700">{product.seatUsage}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
          <span className="truncate">{product.quotaLabel}</span>
          <span>{product.quotaPercent}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${accent.dot}`} style={{ width: `${product.quotaPercent}%` }} />
        </div>
      </div>
      <Link
        href={product.appHref}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-800 transition-colors hover:border-slate-300 hover:bg-white"
      >
        Open App
        <WexonIcon name="arrowRight" size={13} />
      </Link>
    </div>
  );
}

function PortalShell() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_40px_90px_-45px_rgba(2,44,34,0.35)]">
      <div className="grid grid-cols-1 md:grid-cols-[210px_1fr]">
        <aside className="border-b border-slate-100 bg-slate-50/70 p-3 md:min-h-[480px] md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <WexonIcon name="products" size={16} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black text-slate-950">Customer Portal</p>
              <p className="text-[10px] font-semibold text-slate-400">Kadıköy Lezzet</p>
            </div>
          </div>
          <nav className="mt-2 flex gap-1.5 overflow-x-auto md:mt-3 md:flex-col md:overflow-visible">
            {PORTAL_NAV_ITEMS.map((item) => (
              <span
                key={item.label}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold ${
                  item.active
                    ? "bg-white text-slate-950 shadow-sm shadow-slate-200/60 md:border md:border-slate-200"
                    : "text-slate-500"
                }`}
              >
                <WexonIcon name={item.icon} size={15} className={item.active ? "text-emerald-600" : "text-slate-400"} />
                {item.label}
              </span>
            ))}
          </nav>
        </aside>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-black tracking-tight text-slate-950">Kadıköy Lezzet A.Ş.</p>
              <p className="text-[11px] font-medium text-slate-500">Organization paneli · yalnızca kendi kapsamı</p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Owner
            </span>
          </div>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Active Products</p>
          <div className="mt-2 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {CUSTOMER_PRODUCTS.map((product) => (
              <ProductTile key={product.name} product={product} />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Billing summary</p>
              <dl className="mt-2 grid grid-cols-2 gap-3">
                {[
                  { label: "Current plan", value: CUSTOMER_BILLING.currentPlan },
                  { label: "Next invoice", value: CUSTOMER_BILLING.nextInvoiceDate },
                  { label: "Payment method", value: CUSTOMER_BILLING.paymentMethod },
                  { label: "Outstanding", value: CUSTOMER_BILLING.outstandingBalance, warn: true },
                ].map((row) => (
                  <div key={row.label}>
                    <dt className="text-[11px] font-medium text-slate-400">{row.label}</dt>
                    <dd className={`mt-0.5 text-[13px] font-bold ${row.warn ? "text-amber-600" : "text-slate-900"}`}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Team</p>
              <ul className="mt-2 space-y-1.5">
                {CUSTOMER_TEAM.map((member) => (
                  <li key={member.email} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                        {member.name.charAt(0)}
                      </span>
                      <span className="truncate text-[12px] font-semibold text-slate-800">{member.name}</span>
                    </span>
                    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerPortalPreviewSection() {
  return (
    <SectionShell tone="subtle" width="wide">
      <SectionHeading
        eyebrow="Customer Portal"
        title={
          <>
            Müşteriler ürünlerini, lisanslarını ve faturalarını{" "}
            <span className="text-emerald-600">tek panelden yönetir</span>
          </>
        }
        subtitle="Customer Portal, organization sahiplerine kendi aktif ürünlerini, lisanslarını, aboneliklerini, faturalarını ve ekip erişimlerini yönetme alanı sağlar."
      />

      <div className="mx-auto mt-12 max-w-5xl">
        <PortalShell />
        <div className="mt-8 text-center">
          <Button href="/login?next=%2Fdashboard" variant="secondary" withArrow>
            Customer Portal girişi
          </Button>
        </div>
      </div>
    </SectionShell>
  );
}

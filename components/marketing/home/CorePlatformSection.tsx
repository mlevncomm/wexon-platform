import { ADMIN_ACTIVITY, ADMIN_METRICS, ADMIN_NAV_ITEMS, ADMIN_ORGANIZATIONS, CORE_CAPABILITIES } from "@/lib/wexon-home-content";
import SectionShell from "@/components/ui/SectionShell";
import FeatureChip from "@/components/ui/FeatureChip";
import SectionHeading from "./SectionHeading";
import StatusBadge, { STATUS_DOT_CLASS, STATUS_TONE_CLASS } from "./StatusBadge";
import { WexonIcon } from "./icons";

function AdminPanelShell() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_40px_90px_-45px_rgba(2,44,34,0.4)]">
      <div className="grid grid-cols-1 md:grid-cols-[212px_1fr]">
        {/* Dark sidebar — internal management tool feel */}
        <aside className="bg-slate-950 p-3 md:min-h-[520px]">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <WexonIcon name="layers" size={18} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black text-white">Wexon Core</p>
              <p className="text-[10px] font-semibold text-slate-500">Admin</p>
            </div>
          </div>
          <nav className="mt-2 flex gap-1.5 overflow-x-auto md:mt-3 md:flex-col md:overflow-visible">
            {ADMIN_NAV_ITEMS.map((item) => (
              <span
                key={item.label}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold ${
                  item.active
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-slate-400 md:hover:bg-white/5"
                }`}
              >
                <WexonIcon name={item.icon} size={15} className={item.active ? "text-emerald-400" : "text-slate-500"} />
                {item.label}
              </span>
            ))}
          </nav>
        </aside>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-black tracking-tight text-slate-950">Yönetim Paneli</p>
              <p className="text-[11px] font-medium text-slate-500">Tüm organization&apos;lar tek merkezden</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Internal
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {ADMIN_METRICS.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="truncate text-[11px] font-semibold text-slate-400">{metric.label}</p>
                <p className="mt-1 text-lg font-black tracking-tight text-slate-950">{metric.value}</p>
                <p
                  className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold ${
                    metric.tone === "warning"
                      ? "text-amber-600"
                      : metric.tone === "error"
                        ? "text-rose-600"
                        : "text-emerald-600"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[metric.tone ?? "neutral"]}`} />
                  {metric.hint}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-[13px] font-bold text-slate-700">Organizations</p>
                <span className="text-[11px] font-semibold text-slate-400">Billing ≠ Access</span>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="grid grid-cols-[1.5fr_1.3fr_0.9fr_1fr_1fr_1fr] gap-2 border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.04em] text-slate-400">
                    <span>Organization</span>
                    <span>Active Products</span>
                    <span>Plan</span>
                    <span>Billing State</span>
                    <span>Access State</span>
                    <span className="text-right">Status</span>
                  </div>
                  {ADMIN_ORGANIZATIONS.map((org) => (
                    <div
                      key={org.organization}
                      className="grid grid-cols-[1.5fr_1.3fr_0.9fr_1fr_1fr_1fr] items-center gap-2 border-b border-slate-50 px-4 py-2.5 last:border-b-0"
                    >
                      <span className="truncate text-[12px] font-bold text-slate-900">{org.organization}</span>
                      <span className="truncate text-[11px] font-medium text-slate-500">{org.activeProducts}</span>
                      <span className="text-[11px] font-semibold text-slate-600">{org.plan}</span>
                      <span><StatusBadge badge={org.billingState} /></span>
                      <span><StatusBadge badge={org.accessState} /></span>
                      <span className="flex justify-end"><StatusBadge badge={org.status} dot /></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Son aktiviteler</p>
              <div className="mt-2 space-y-1.5">
                {ADMIN_ACTIVITY.map((item) => (
                  <div key={item.title} className="flex items-start gap-2.5 rounded-lg px-1 py-1.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${STATUS_TONE_CLASS[item.tone]}`}
                    >
                      <WexonIcon name={item.icon} size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-slate-900">{item.title}</p>
                      <p className="truncate text-[11px] font-medium text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CORE_HIGHLIGHT_CARDS = [
  {
    label: "Access state",
    value: "Lisans + entitlement → ürün erişimi",
    accent: true,
  },
  {
    label: "Billing state",
    value: "Ödeme durumu ayrı hesaplanır",
    accent: false,
  },
  {
    label: "Bağlı ürünler",
    value: "WexPay · WexHotel · WexB2B erişimi Core'dan",
    accent: false,
  },
];

export default function CorePlatformSection() {
  return (
    <SectionShell id="core" tone="white" width="wide">
      <SectionHeading
        eyebrow="Wexon Core · Admin"
        title={
          <>
            Wexon Core tüm ürünlerin <span className="text-emerald-600">merkezi yönetim katmanıdır</span>
          </>
        }
        subtitle="Organization, lisans, abonelik, ödeme ve entitlement kararları tek merkezden yönetilir. Erişim; ödeme durumundan değil, lisans ve entitlement mantığından hesaplanır."
      />

      <div className="mt-12">
        <AdminPanelShell />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CORE_HIGHLIGHT_CARDS.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 ${
              card.accent ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50"
            }`}
          >
            <p
              className={`text-[11px] font-bold uppercase tracking-[0.08em] ${
                card.accent ? "text-emerald-700" : "text-slate-500"
              }`}
            >
              {card.label}
            </p>
            <p
              className={`mt-1 text-[13px] font-semibold leading-snug ${
                card.accent ? "text-emerald-900" : "text-slate-700"
              }`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CORE_CAPABILITIES.map((cap) => (
          <FeatureChip
            key={cap.title}
            icon={cap.icon}
            title={cap.title}
            description={cap.description}
            layout="inline"
          />
        ))}
      </div>
    </SectionShell>
  );
}

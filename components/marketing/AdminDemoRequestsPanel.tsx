import Link from "next/link";
import {
  AdminEmptyState,
  AdminPanel,
  AdminSectionTitle,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
} from "@/components/marketing/WexonAdminCards";
import { AdminSubmitButton } from "@/components/marketing/WexonAdminForms";
import { formatAdminDate } from "@/lib/wexon-admin";
import { updateAdminDemoRequestFollowUpAction, updateAdminDemoRequestStatusAction } from "@/lib/wexon-admin-actions";
import {
  demoLeadStatusBadgeClass,
  demoLeadStatusLabels,
  demoLeadStatuses,
  followUpDateBadgeClass,
  followUpDateStateLabels,
  formatFollowUpDateLabel,
  resolveFollowUpDateState,
  type DemoLeadFollowUp,
  type DemoLeadStatus,
} from "@/lib/wexon-demo-request-leads";
import { demoRequestSourceLabels } from "@/lib/wexon-public-validation";

type DemoRequestMeta = {
  fullName?: string;
  company?: string;
  email?: string;
  phone?: string;
  product?: string;
  message?: string;
  status?: string;
  source?: string;
};

export type AdminDemoRequestRow = {
  id: string;
  createdAt: Date;
  metadataJson: unknown;
  leadStatus: DemoLeadStatus;
  followUp: DemoLeadFollowUp;
};

export type AdminDemoRequestFilters = {
  product?: string;
  source?: string;
};

const demoProducts = ["WexPay", "WexHotel", "WexB2B", "Wexon Core"] as const;

const demoSourceOptions = [
  { value: "on-basvuru", label: demoRequestSourceLabels["on-basvuru"] },
  { value: "links", label: demoRequestSourceLabels.links },
  { value: "wexpay-demo", label: demoRequestSourceLabels["wexpay-demo"] },
  { value: "direct", label: demoRequestSourceLabels.direct },
] as const;

function readDemoMeta(value: unknown): DemoRequestMeta {
  return typeof value === "object" && value !== null ? (value as DemoRequestMeta) : {};
}

function resolveSource(meta: DemoRequestMeta) {
  const key = meta.source?.trim().toLowerCase() || "direct";
  return {
    key,
    label: demoRequestSourceLabels[key] ?? meta.source ?? demoRequestSourceLabels.direct,
  };
}

function buildSupportReturnTo(filters: AdminDemoRequestFilters, basePath = "/admin/support") {
  const params = new URLSearchParams();
  if (filters.product && filters.product !== "all") {
    params.set("demoProduct", filters.product);
  }
  if (filters.source && filters.source !== "all") {
    params.set("demoSource", filters.source);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function productBadgeClass(product?: string) {
  switch (product) {
    case "WexPay":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    case "WexHotel":
      return "bg-sky-50 text-sky-700 ring-sky-100";
    case "WexB2B":
      return "bg-violet-50 text-violet-700 ring-violet-100";
    case "Wexon Core":
      return "bg-slate-100 text-slate-700 ring-slate-200/80";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200/80";
  }
}

function sourceBadgeClass(sourceKey: string) {
  switch (sourceKey) {
    case "links":
      return "bg-teal-50 text-teal-700 ring-teal-100";
    case "wexpay-demo":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    case "on-basvuru":
      return "bg-blue-50 text-blue-700 ring-blue-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200/80";
  }
}

function DemoBadge({ children, className }: { children: string; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

function LeadStatusBadge({ status }: { status: DemoLeadStatus }) {
  return <DemoBadge className={demoLeadStatusBadgeClass(status)}>{demoLeadStatusLabels[status]}</DemoBadge>;
}

function FollowUpDateBadge({ followUpAt }: { followUpAt: string | null }) {
  const state = resolveFollowUpDateState(followUpAt);
  if (!state) return null;

  return <DemoBadge className={followUpDateBadgeClass(state)}>{followUpDateStateLabels[state]}</DemoBadge>;
}

function FollowUpSummary({ followUp, compact = false }: { followUp: DemoLeadFollowUp; compact?: boolean }) {
  const dateLabel = formatFollowUpDateLabel(followUp.followUpAt);

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-2">
        {dateLabel ? (
          <span className="text-xs font-bold text-slate-700">{dateLabel}</span>
        ) : (
          <span className="text-xs font-semibold text-slate-400">Takip tarihi yok</span>
        )}
        <FollowUpDateBadge followUpAt={followUp.followUpAt} />
      </div>
      <p className={`break-words text-slate-600 ${compact ? "line-clamp-2 text-xs leading-relaxed" : "text-sm leading-relaxed"}`}>
        {followUp.note ?? "Takip notu yok."}
      </p>
    </div>
  );
}

function LeadFollowUpUpdateForm({
  requestId,
  followUp,
  returnTo,
  compact = false,
}: {
  requestId: string;
  followUp: DemoLeadFollowUp;
  returnTo: string;
  compact?: boolean;
}) {
  const updateFollowUp = updateAdminDemoRequestFollowUpAction.bind(null, requestId);
  const defaultDate = followUp.followUpAt?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

  return (
    <form action={updateFollowUp} className={compact ? "mt-3 space-y-2" : "mt-4 space-y-2"}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="block min-w-0">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Takip notu</span>
        <textarea
          name="note"
          rows={compact ? 2 : 3}
          defaultValue={followUp.note ?? ""}
          placeholder="Kısa takip notu..."
          className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-950 outline-none transition focus:border-emerald-300"
        />
      </label>
      <label className="block min-w-0">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Takip tarihi</span>
        <input
          name="followUpAt"
          type="date"
          defaultValue={defaultDate}
          className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-950 outline-none transition focus:border-emerald-300"
        />
      </label>
      <AdminSubmitButton>Kaydet</AdminSubmitButton>
    </form>
  );
}

function filterDemoRequests(requests: AdminDemoRequestRow[], filters: AdminDemoRequestFilters) {
  const product = filters.product?.trim();
  const source = filters.source?.trim();

  return requests.filter((request) => {
    const meta = readDemoMeta(request.metadataJson);
    if (product && product !== "all" && (meta.product ?? "—") !== product) {
      return false;
    }
    const sourceKey = resolveSource(meta).key;
    if (source && source !== "all" && sourceKey !== source) {
      return false;
    }
    return true;
  });
}

function QuickActionLink({
  href,
  label,
  disabled,
}: {
  href: string;
  label: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-300">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
    >
      {label}
    </Link>
  );
}

function LeadStatusUpdateForm({
  requestId,
  leadStatus,
  returnTo,
  compact = false,
}: {
  requestId: string;
  leadStatus: DemoLeadStatus;
  returnTo: string;
  compact?: boolean;
}) {
  const updateStatus = updateAdminDemoRequestStatusAction.bind(null, requestId);

  return (
    <form action={updateStatus} className={compact ? "flex min-w-[160px] flex-col gap-2" : "mt-4 space-y-2"}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <select
        name="leadStatus"
        defaultValue={leadStatus}
        aria-label="Lead durumu"
        className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-950 outline-none transition focus:border-emerald-300"
      >
        {demoLeadStatuses.map((status) => (
          <option key={status} value={status}>
            {demoLeadStatusLabels[status]}
          </option>
        ))}
      </select>
      <AdminSubmitButton>Güncelle</AdminSubmitButton>
    </form>
  );
}

function DemoRequestCard({
  request,
  returnTo,
}: {
  request: AdminDemoRequestRow;
  returnTo: string;
}) {
  const meta = readDemoMeta(request.metadataJson);
  const source = resolveSource(meta);
  const email = meta.email?.trim();
  const phone = meta.phone?.trim();

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-lg font-black text-slate-950">{meta.fullName ?? "—"}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-600">{meta.company ?? "—"}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{formatAdminDate(request.createdAt)}</p>
        </div>
        <LeadStatusBadge status={request.leadStatus} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <DemoBadge className={productBadgeClass(meta.product)}>{meta.product ?? "—"}</DemoBadge>
        <DemoBadge className={sourceBadgeClass(source.key)}>{source.label}</DemoBadge>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">E-posta</p>
          <p className="mt-1 break-all font-semibold text-slate-700">{email ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Telefon</p>
          <p className="mt-1 break-words font-semibold text-slate-700">{phone ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Talep notu</p>
          <p className="mt-1 break-words leading-relaxed text-slate-600">{meta.message ?? "—"}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <QuickActionLink href={email ? `mailto:${email}` : "#"} label="E-posta" disabled={!email} />
        <QuickActionLink href={phone ? `tel:${phone.replace(/\s/g, "")}` : "#"} label="Telefon" disabled={!phone} />
      </div>

      <LeadStatusUpdateForm requestId={request.id} leadStatus={request.leadStatus} returnTo={returnTo} />

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Son takip</p>
        <FollowUpSummary followUp={request.followUp} />
        <LeadFollowUpUpdateForm requestId={request.id} followUp={request.followUp} returnTo={returnTo} compact />
      </div>
    </article>
  );
}

function DemoRequestTableRow({
  request,
  returnTo,
}: {
  request: AdminDemoRequestRow;
  returnTo: string;
}) {
  const meta = readDemoMeta(request.metadataJson);
  const source = resolveSource(meta);
  const email = meta.email?.trim();
  const phone = meta.phone?.trim();

  return (
    <tr className="align-top transition-colors hover:bg-slate-50/80">
      <td className="whitespace-nowrap px-4 py-5 text-xs font-semibold text-slate-500 xl:px-6">
        <span className="block font-bold text-slate-700">{formatAdminDate(request.createdAt)}</span>
      </td>
      <td className="px-4 py-5 xl:px-6">
        <div className="min-w-[168px] space-y-3">
          <LeadStatusBadge status={request.leadStatus} />
          <LeadStatusUpdateForm requestId={request.id} leadStatus={request.leadStatus} returnTo={returnTo} compact />
        </div>
      </td>
      <td className="min-w-[180px] px-4 py-5 xl:min-w-[220px] xl:px-6">
        <p className="break-words text-base font-black leading-snug text-slate-950">{meta.fullName ?? "—"}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-600 2xl:hidden">{meta.company ?? "—"}</p>
      </td>
      <td className="hidden min-w-[180px] px-4 py-5 2xl:table-cell xl:px-6">
        <p className="break-words text-sm font-semibold text-slate-700">{meta.company ?? "—"}</p>
      </td>
      <td className="min-w-[220px] px-4 py-5 xl:min-w-[260px] xl:px-6">
        <div className="space-y-2">
          <p className="break-all text-sm font-semibold text-slate-700">{email ?? "—"}</p>
          <p className="break-words text-sm font-semibold text-slate-500 xl:hidden">{phone ?? "—"}</p>
        </div>
      </td>
      <td className="hidden min-w-[140px] px-4 py-5 xl:table-cell xl:px-6">
        <p className="break-words text-sm font-semibold text-slate-600">{phone ?? "—"}</p>
      </td>
      <td className="px-4 py-5 xl:px-6">
        <div className="flex min-w-[108px] flex-col gap-2">
          <DemoBadge className={productBadgeClass(meta.product)}>{meta.product ?? "—"}</DemoBadge>
          <DemoBadge className={`2xl:hidden ${sourceBadgeClass(source.key)}`}>{source.label}</DemoBadge>
        </div>
      </td>
      <td className="hidden min-w-[130px] px-4 py-5 2xl:table-cell xl:px-6">
        <DemoBadge className={sourceBadgeClass(source.key)}>{source.label}</DemoBadge>
      </td>
      <td className="min-w-[240px] px-4 py-5 xl:min-w-[320px] xl:px-6">
        <p className="line-clamp-4 break-words text-sm leading-relaxed text-slate-600">{meta.message ?? "—"}</p>
      </td>
      <td className="min-w-[280px] px-4 py-5 xl:min-w-[340px] xl:px-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
          <FollowUpSummary followUp={request.followUp} compact />
          <LeadFollowUpUpdateForm requestId={request.id} followUp={request.followUp} returnTo={returnTo} compact />
        </div>
      </td>
      <td className="px-4 py-5 xl:px-6">
        <div className="flex min-w-[112px] flex-col gap-2">
          <QuickActionLink href={email ? `mailto:${email}` : "#"} label="E-posta" disabled={!email} />
          <QuickActionLink href={phone ? `tel:${phone.replace(/\s/g, "")}` : "#"} label="Telefon" disabled={!phone} />
        </div>
      </td>
    </tr>
  );
}

function DemoRequestTable({
  requests,
  returnTo,
}: {
  requests: AdminDemoRequestRow[];
  returnTo: string;
}) {
  return (
    <AdminTableShell>
      <table className="w-full min-w-[960px] border-collapse text-left text-sm xl:min-w-[1280px] 2xl:min-w-[1480px]">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 text-[11px] uppercase tracking-[0.14em] text-slate-500 backdrop-blur-sm">
          <tr>
            <th className="px-4 py-4 font-black xl:px-6">Tarih</th>
            <th className="px-4 py-4 font-black xl:px-6">Durum</th>
            <th className="px-4 py-4 font-black xl:px-6">Ad soyad</th>
            <th className="hidden px-4 py-4 font-black 2xl:table-cell xl:px-6">Firma</th>
            <th className="px-4 py-4 font-black xl:px-6">E-posta</th>
            <th className="hidden px-4 py-4 font-black xl:table-cell xl:px-6">Telefon</th>
            <th className="px-4 py-4 font-black xl:px-6">Ürün</th>
            <th className="hidden px-4 py-4 font-black 2xl:table-cell xl:px-6">Kaynak</th>
            <th className="px-4 py-4 font-black xl:px-6">Talep notu</th>
            <th className="px-4 py-4 font-black xl:px-6">Takip</th>
            <th className="px-4 py-4 font-black xl:px-6">Aksiyon</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {requests.map((request) => (
            <DemoRequestTableRow key={request.id} request={request} returnTo={returnTo} />
          ))}
        </tbody>
      </table>
    </AdminTableShell>
  );
}

export default function AdminDemoRequestsPanel({
  requests,
  filters,
  basePath = "/admin/support",
  title = "Public demo talepleri",
  description = "WexPay demo, /links ve demo-request formundan gelen lead kayıtları. En yeni talepler üstte listelenir.",
  showSummaryCards = true,
}: {
  requests: AdminDemoRequestRow[];
  filters: AdminDemoRequestFilters;
  basePath?: string;
  title?: string;
  description?: string;
  showSummaryCards?: boolean;
}) {
  const returnTo = buildSupportReturnTo(filters, basePath);
  const filteredRequests = filterDemoRequests(requests, filters);
  const wexPayCount = requests.filter((request) => readDemoMeta(request.metadataJson).product === "WexPay").length;
  const linksCount = requests.filter((request) => resolveSource(readDemoMeta(request.metadataJson)).key === "links").length;
  const demoSourceCount = requests.filter(
    (request) => resolveSource(readDemoMeta(request.metadataJson)).key === "wexpay-demo",
  ).length;
  const hasActiveFilter =
    (filters.product && filters.product !== "all") || (filters.source && filters.source !== "all");

  return (
    <AdminPanel className="overflow-hidden p-0">
      <div className="p-5 sm:p-8">
      <AdminSectionTitle
        badge="Demo"
        title={title}
        description={description}
      />

      {showSummaryCards ? (
      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Toplam talep" value={requests.length} />
        <AdminSummaryCard label="WexPay" value={wexPayCount} />
        <AdminSummaryCard label="WexPay Links" value={linksCount} />
        <AdminSummaryCard label="WexPay Demo" value={demoSourceCount} />
      </section>
      ) : null}

      <form method="get" className="mb-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-end">
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-semibold text-slate-500">Ürün</span>
          <select
            name="demoProduct"
            defaultValue={filters.product ?? "all"}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-300"
          >
            <option value="all">Tümü</option>
            {demoProducts.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-semibold text-slate-500">Kaynak</span>
          <select
            name="demoSource"
            defaultValue={filters.source ?? "all"}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-300"
          >
            <option value="all">Tümü</option>
            {demoSourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-black text-white transition-colors hover:bg-emerald-700"
        >
          Filtrele
        </button>

        {hasActiveFilter ? (
          <Link
            href={basePath}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Sıfırla
          </Link>
        ) : (
          <span className="hidden lg:block" aria-hidden />
        )}
      </form>

      {requests.length === 0 ? (
        <AdminEmptyState>Henüz public demo talebi yok.</AdminEmptyState>
      ) : filteredRequests.length === 0 ? (
        <AdminEmptyState>Filtreye uygun demo talebi bulunamadı.</AdminEmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <AdminStatusPill active>{`${filteredRequests.length} kayıt gösteriliyor`}</AdminStatusPill>
            {hasActiveFilter ? <span>Filtrelenmiş görünüm</span> : null}
            <span className="hidden md:inline">Geniş tablo için yatay kaydırma kullanılabilir.</span>
          </div>
        </>
      )}
      </div>

      {filteredRequests.length > 0 ? (
        <>
          <div className="hidden md:block">
            <DemoRequestTable requests={filteredRequests} returnTo={returnTo} />
          </div>

          <div className="space-y-4 p-5 md:hidden sm:p-8">
            {filteredRequests.map((request) => (
              <DemoRequestCard key={request.id} request={request} returnTo={returnTo} />
            ))}
          </div>
        </>
      ) : null}
    </AdminPanel>
  );
}

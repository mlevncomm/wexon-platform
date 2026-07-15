import Link from "next/link";
import type { ReactNode } from "react";
import AdminDetailDrawer from "@/components/marketing/AdminDetailDrawer";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminPanel,
  AdminSectionTitle,
  AdminStatGrid,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
} from "@/components/marketing/WexonAdminCards";
import { AdminKeyValueList, AdminResultCount, AdminSoftNotice } from "@/components/marketing/WexonAdminContent";
import { AdminSubmitButton } from "@/components/marketing/WexonAdminForms";
import WexPayEligibilityAdminCard from "@/components/marketing/WexPayEligibilityAdminCard";
import { formatAdminDate, formatAdminDateTime } from "@/lib/wexon-admin";
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
import {
  buildWexPayEligibilityAdminView,
  eligibilityListBadges,
  type ReviewStatusBadgeTone,
} from "@/lib/wexpay-eligibility-admin-display";

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
  status?: string;
  reviewStatus?: string;
  followUp?: string;
  q?: string;
  leadId?: string;
};

const demoProducts = ["WexPay", "WexHotel", "WexB2B", "Wexon Core"] as const;

const demoSourceOptions = [
  { value: "on-basvuru", label: demoRequestSourceLabels["on-basvuru"] },
  { value: "links", label: demoRequestSourceLabels.links },
  { value: "wexpay-demo", label: demoRequestSourceLabels["wexpay-demo"] },
  { value: "direct", label: demoRequestSourceLabels.direct },
] as const;

const reviewStatusOptions = [
  { value: "auto_approve", label: "Ön uygunluk" },
  { value: "manual_review", label: "Manuel inceleme" },
  { value: "reject", label: "Uygun değil" },
] as const;

const followUpFilterOptions = [
  { value: "today", label: "Takip: bugün" },
  { value: "overdue", label: "Takip: gecikmiş" },
  { value: "scheduled", label: "Takip: planlı" },
  { value: "none", label: "Takip tarihi yok" },
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

export function buildDemoRequestsReturnTo(filters: AdminDemoRequestFilters, basePath = "/admin/support") {
  const params = new URLSearchParams();
  if (filters.product && filters.product !== "all") params.set("demoProduct", filters.product);
  if (filters.source && filters.source !== "all") params.set("demoSource", filters.source);
  if (filters.status && filters.status !== "all") params.set("demoStatus", filters.status);
  if (filters.reviewStatus && filters.reviewStatus !== "all") params.set("demoReview", filters.reviewStatus);
  if (filters.followUp && filters.followUp !== "all") params.set("demoFollowUp", filters.followUp);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function leadDetailHref(filters: AdminDemoRequestFilters, basePath: string, leadId: string) {
  const base = buildDemoRequestsReturnTo(filters, basePath);
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}leadId=${encodeURIComponent(leadId)}`;
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

function eligibilityToneBadgeClass(tone: ReviewStatusBadgeTone) {
  switch (tone) {
    case "success":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    case "warning":
      return "bg-amber-50 text-amber-900 ring-amber-100";
    case "danger":
      return "bg-rose-50 text-rose-800 ring-rose-100";
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

function EligibilityListBadges({ metadataJson }: { metadataJson: unknown }) {
  const badges = eligibilityListBadges(metadataJson);
  if (!badges.recommendedTierLabel && !badges.reviewStatusLabel) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {badges.recommendedTierLabel ? (
        <DemoBadge className="bg-emerald-50 text-emerald-800 ring-emerald-100">
          {badges.recommendedTierLabel.replace(/^WexPay\s+/i, "")}
        </DemoBadge>
      ) : null}
      {badges.reviewStatusLabel ? (
        <DemoBadge className={eligibilityToneBadgeClass(badges.reviewStatusTone)}>{badges.reviewStatusLabel}</DemoBadge>
      ) : null}
    </div>
  );
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

const fieldClass =
  "mt-1.5 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold text-slate-950 outline-none transition focus:border-emerald-300 sm:h-10 sm:text-sm";

function LeadStatusUpdateForm({
  requestId,
  leadStatus,
  returnTo,
}: {
  requestId: string;
  leadStatus: DemoLeadStatus;
  returnTo: string;
}) {
  const updateStatus = updateAdminDemoRequestStatusAction.bind(null, requestId);
  return (
    <form action={updateStatus} className="space-y-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="block min-w-0">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Durum</span>
        <select name="leadStatus" defaultValue={leadStatus} aria-label="Lead durumu" className={fieldClass}>
          {demoLeadStatuses.map((status) => (
            <option key={status} value={status}>
              {demoLeadStatusLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <AdminSubmitButton>Durumu güncelle</AdminSubmitButton>
    </form>
  );
}

function LeadFollowUpUpdateForm({
  requestId,
  followUp,
  returnTo,
}: {
  requestId: string;
  followUp: DemoLeadFollowUp;
  returnTo: string;
}) {
  const updateFollowUp = updateAdminDemoRequestFollowUpAction.bind(null, requestId);
  const defaultDate = followUp.followUpAt?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
  return (
    <form action={updateFollowUp} className="space-y-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="block min-w-0">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Takip notu</span>
        <textarea
          name="note"
          rows={3}
          defaultValue={followUp.note ?? ""}
          placeholder="Kısa takip notu..."
          className={`${fieldClass} h-auto py-2.5`}
        />
      </label>
      <label className="block min-w-0">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Takip tarihi</span>
        <input name="followUpAt" type="date" defaultValue={defaultDate} className={fieldClass} />
      </label>
      {followUp.updatedAt ? (
        <p className="text-[11px] font-semibold text-slate-400">
          Son güncelleme: {formatAdminDateTime(followUp.updatedAt)}
        </p>
      ) : null}
      <AdminSubmitButton>Takibi kaydet</AdminSubmitButton>
    </form>
  );
}

function filterDemoRequests(requests: AdminDemoRequestRow[], filters: AdminDemoRequestFilters) {
  const product = filters.product?.trim();
  const source = filters.source?.trim();
  const status = filters.status?.trim();
  const reviewStatus = filters.reviewStatus?.trim();
  const followUp = filters.followUp?.trim();
  const q = filters.q?.trim().toLowerCase();

  return requests.filter((request) => {
    const meta = readDemoMeta(request.metadataJson);
    if (product && product !== "all" && (meta.product ?? "—") !== product) return false;
    const sourceKey = resolveSource(meta).key;
    if (source && source !== "all" && sourceKey !== source) return false;
    if (status && status !== "all" && request.leadStatus !== status) return false;

    const eligibility = buildWexPayEligibilityAdminView(request.metadataJson);
    if (reviewStatus && reviewStatus !== "all" && eligibility.reviewStatusRaw !== reviewStatus) return false;

    if (followUp && followUp !== "all") {
      const state = resolveFollowUpDateState(request.followUp.followUpAt);
      if (followUp === "none" && state) return false;
      if (followUp !== "none" && state !== followUp) return false;
    }

    if (q) {
      const haystack = [meta.fullName, meta.company, meta.email, meta.phone, meta.message]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
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
    return <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-300">{label}</span>;
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

function LeadDetailBody({
  request,
  returnTo,
}: {
  request: AdminDemoRequestRow;
  returnTo: string;
}) {
  const meta = readDemoMeta(request.metadataJson);
  const source = resolveSource(meta);
  const eligibility = buildWexPayEligibilityAdminView(request.metadataJson);
  const email = meta.email?.trim();
  const phone = meta.phone?.trim();

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Kimlik ve iletişim</h3>
        <AdminKeyValueList
          items={[
            { label: "Ad soyad", value: meta.fullName ?? "—" },
            { label: "Firma", value: meta.company ?? "—" },
            { label: "E-posta", value: email ?? "—" },
            { label: "Telefon", value: phone ?? "—" },
            { label: "Kayıt", value: formatAdminDateTime(request.createdAt) },
            { label: "Kaynak", value: source.label },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <QuickActionLink href={email ? `mailto:${email}` : "#"} label="E-posta gönder" disabled={!email} />
          <QuickActionLink href={phone ? `tel:${phone.replace(/\s/g, "")}` : "#"} label="Ara" disabled={!phone} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Başvuru özeti</h3>
        <AdminKeyValueList
          items={[
            { label: "Ürün", value: meta.product ?? "—" },
            { label: "Durum", value: demoLeadStatusLabels[request.leadStatus] },
            {
              label: "Talep notu",
              value: <span className="whitespace-pre-wrap">{meta.message?.trim() || "—"}</span>,
            },
          ]}
        />
      </section>

      {eligibility.hasEligibilitySignal ? (
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">WexPay uygunluk</h3>
          <WexPayEligibilityAdminCard metadataJson={request.metadataJson} />
          <AdminSoftNotice>
            Ön uygunluk, nihai ticari veya ödeme sağlayıcısı onayı anlamına gelmez. Dahili risk notları yalnızca admin
            panelinde görünür.
          </AdminSoftNotice>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Durum güncelle</h3>
        <LeadStatusUpdateForm requestId={request.id} leadStatus={request.leadStatus} returnTo={returnTo} />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Takip</h3>
        <FollowUpSummary followUp={request.followUp} />
        <LeadFollowUpUpdateForm requestId={request.id} followUp={request.followUp} returnTo={returnTo} />
      </section>
    </div>
  );
}

function DemoRequestCard({
  request,
  detailHref,
}: {
  request: AdminDemoRequestRow;
  detailHref: string;
}) {
  const meta = readDemoMeta(request.metadataJson);
  const source = resolveSource(meta);
  return (
    <article className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-black text-slate-950">{meta.fullName ?? "—"}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{meta.company ?? "—"}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">{formatAdminDate(request.createdAt)}</p>
          </div>
          <LeadStatusBadge status={request.leadStatus} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <DemoBadge className={productBadgeClass(meta.product)}>{meta.product ?? "—"}</DemoBadge>
          <DemoBadge className={sourceBadgeClass(source.key)}>{source.label}</DemoBadge>
          <EligibilityListBadges metadataJson={request.metadataJson} />
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{meta.message ?? "—"}</p>
        <Link
          href={detailHref}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white"
        >
          Detayı aç
        </Link>
      </div>
    </article>
  );
}

function DemoRequestTable({
  requests,
  filters,
  basePath,
}: {
  requests: AdminDemoRequestRow[];
  filters: AdminDemoRequestFilters;
  basePath: string;
}) {
  return (
    <AdminTableShell>
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm xl:min-w-[1320px]">
        <thead>
          <tr>
            <th scope="col" className="min-w-[120px] font-black uppercase tracking-[0.12em] text-slate-500">
              Tarih
            </th>
            <th scope="col" className="min-w-[120px] font-black uppercase tracking-[0.12em] text-slate-500">
              Durum
            </th>
            <th scope="col" className="min-w-[160px] font-black uppercase tracking-[0.12em] text-slate-500">
              Ad soyad
            </th>
            <th scope="col" className="hidden min-w-[160px] font-black uppercase tracking-[0.12em] text-slate-500 lg:table-cell">
              Firma
            </th>
            <th scope="col" className="min-w-[200px] font-black uppercase tracking-[0.12em] text-slate-500">
              E-posta
            </th>
            <th scope="col" className="hidden min-w-[130px] font-black uppercase tracking-[0.12em] text-slate-500 xl:table-cell">
              Telefon
            </th>
            <th scope="col" className="min-w-[100px] font-black uppercase tracking-[0.12em] text-slate-500">
              Ürün
            </th>
            <th scope="col" className="hidden min-w-[110px] font-black uppercase tracking-[0.12em] text-slate-500 2xl:table-cell">
              Kaynak
            </th>
            <th scope="col" className="hidden min-w-[120px] font-black uppercase tracking-[0.12em] text-slate-500 xl:table-cell">
              Paket / uygunluk
            </th>
            <th scope="col" className="min-w-[140px] font-black uppercase tracking-[0.12em] text-slate-500">
              Takip
            </th>
            <th scope="col" className="sticky right-0 min-w-[110px] bg-slate-50/95 font-black uppercase tracking-[0.12em] text-slate-500">
              Aksiyon
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {requests.map((request) => {
            const meta = readDemoMeta(request.metadataJson);
            const source = resolveSource(meta);
            const detailHref = leadDetailHref(filters, basePath, request.id);
            return (
              <tr key={request.id} className="align-top">
                <td className="whitespace-nowrap text-xs font-semibold text-slate-500">
                  {formatAdminDate(request.createdAt)}
                </td>
                <td>
                  <LeadStatusBadge status={request.leadStatus} />
                </td>
                <td>
                  <p className="font-black text-slate-950" title={meta.fullName}>
                    <span className="line-clamp-2">{meta.fullName ?? "—"}</span>
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500 lg:hidden">{meta.company ?? "—"}</p>
                </td>
                <td className="hidden lg:table-cell">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-700">{meta.company ?? "—"}</p>
                </td>
                <td>
                  <p className="line-clamp-2 break-all text-sm font-semibold text-slate-700" title={meta.email}>
                    {meta.email ?? "—"}
                  </p>
                </td>
                <td className="hidden xl:table-cell">
                  <p className="text-sm font-semibold text-slate-600">{meta.phone ?? "—"}</p>
                </td>
                <td>
                  <DemoBadge className={productBadgeClass(meta.product)}>{meta.product ?? "—"}</DemoBadge>
                </td>
                <td className="hidden 2xl:table-cell">
                  <DemoBadge className={sourceBadgeClass(source.key)}>{source.label}</DemoBadge>
                </td>
                <td className="hidden xl:table-cell">
                  <EligibilityListBadges metadataJson={request.metadataJson} />
                </td>
                <td>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700">{formatFollowUpDateLabel(request.followUp.followUpAt) ?? "—"}</p>
                    <FollowUpDateBadge followUpAt={request.followUp.followUpAt} />
                    {request.followUp.note ? (
                      <p className="line-clamp-2 text-xs text-slate-500" title={request.followUp.note}>
                        {request.followUp.note}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="sticky right-0 bg-white">
                  <Link
                    href={detailHref}
                    className="inline-flex rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
                  >
                    Detayı aç
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AdminTableShell>
  );
}

function FilterSelect({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <select name={name} defaultValue={defaultValue} className={fieldClass}>
        {children}
      </select>
    </label>
  );
}

export default function AdminDemoRequestsPanel({
  requests,
  filters,
  basePath = "/admin/support",
  title = "Public demo talepleri",
  description = "WexPay demo, /links ve ön başvuru formlarından gelen lead kayıtları. En yeni talepler üsttedir.",
  showSummaryCards = true,
}: {
  requests: AdminDemoRequestRow[];
  filters: AdminDemoRequestFilters;
  basePath?: string;
  title?: string;
  description?: string;
  showSummaryCards?: boolean;
}) {
  const closeHref = buildDemoRequestsReturnTo(filters, basePath);
  const returnTo = filters.leadId ? leadDetailHref(filters, basePath, filters.leadId) : closeHref;
  const filteredRequests = filterDemoRequests(requests, filters);
  const selected = filters.leadId ? requests.find((request) => request.id === filters.leadId) : undefined;

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const now = new Date().getTime();
  const wexPayCount = requests.filter((request) => readDemoMeta(request.metadataJson).product === "WexPay").length;
  const linksCount = requests.filter((request) => resolveSource(readDemoMeta(request.metadataJson)).key === "links").length;
  const demoSourceCount = requests.filter(
    (request) => resolveSource(readDemoMeta(request.metadataJson)).key === "wexpay-demo",
  ).length;
  const followUpDue = requests.filter((request) => {
    const state = resolveFollowUpDateState(request.followUp.followUpAt);
    return state === "today" || state === "overdue";
  }).length;
  const manualReview = requests.filter(
    (request) => buildWexPayEligibilityAdminView(request.metadataJson).reviewStatusRaw === "manual_review",
  ).length;
  const lastWeek = requests.filter((request) => now - request.createdAt.getTime() <= sevenDaysMs).length;

  const hasActiveFilter = Boolean(
    (filters.product && filters.product !== "all") ||
      (filters.source && filters.source !== "all") ||
      (filters.status && filters.status !== "all") ||
      (filters.reviewStatus && filters.reviewStatus !== "all") ||
      (filters.followUp && filters.followUp !== "all") ||
      filters.q?.trim(),
  );

  return (
    <AdminPanel className="overflow-hidden p-0">
      <div className="p-4 sm:p-6 xl:p-7">
        <AdminSectionTitle badge="CRM" title={title} description={description} />

        {showSummaryCards ? (
          <AdminStatGrid className="mb-6">
            <AdminSummaryCard label="Toplam lead" value={requests.length} helper="Public kaynaklı tüm kayıtlar" />
            <AdminSummaryCard label="WexPay" value={wexPayCount} helper="WexPay ürün ilgisi" />
            <AdminSummaryCard label="WexPay Links" value={linksCount} helper="/links kaynağı" />
            <AdminSummaryCard label="WexPay Demo" value={demoSourceCount} helper="Demo form kaynağı" />
            <AdminSummaryCard label="Takip bekleyen" value={followUpDue} helper="Bugün veya gecikmiş takip" tone="warning" />
            <AdminSummaryCard label="Manuel inceleme" value={manualReview} helper="Eligibility manuel review" tone="warning" />
            <AdminSummaryCard label="Son 7 gün" value={lastWeek} helper="Yeni oluşturulan lead’ler" />
          </AdminStatGrid>
        ) : null}

        <form method="get" action={basePath}>
          <AdminFilterBar className="lg:grid-cols-3 xl:grid-cols-4">
            <label className="grid min-w-0 gap-1.5 text-sm sm:col-span-2 xl:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Ara</span>
              <input
                name="q"
                type="search"
                defaultValue={filters.q ?? ""}
                placeholder="Ad, firma, e-posta veya telefon"
                className={fieldClass}
              />
            </label>
            <FilterSelect label="Ürün" name="demoProduct" defaultValue={filters.product ?? "all"}>
              <option value="all">Tümü</option>
              {demoProducts.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Kaynak" name="demoSource" defaultValue={filters.source ?? "all"}>
              <option value="all">Tümü</option>
              {demoSourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Durum" name="demoStatus" defaultValue={filters.status ?? "all"}>
              <option value="all">Tümü</option>
              {demoLeadStatuses.map((status) => (
                <option key={status} value={status}>
                  {demoLeadStatusLabels[status]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Uygunluk" name="demoReview" defaultValue={filters.reviewStatus ?? "all"}>
              <option value="all">Tümü</option>
              {reviewStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Takip" name="demoFollowUp" defaultValue={filters.followUp ?? "all"}>
              <option value="all">Tümü</option>
              {followUpFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1 xl:items-end">
              <button
                type="submit"
                className="h-11 flex-1 rounded-xl bg-slate-900 px-5 text-sm font-black text-white hover:bg-emerald-700 sm:h-10"
              >
                Filtrele
              </button>
              {hasActiveFilter ? (
                <Link
                  href={basePath}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:h-10"
                >
                  Temizle
                </Link>
              ) : null}
            </div>
          </AdminFilterBar>
        </form>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <AdminResultCount shown={filteredRequests.length} total={requests.length} filtered={hasActiveFilter} />
          {hasActiveFilter ? <AdminStatusPill active>Filtrelenmiş görünüm</AdminStatusPill> : null}
        </div>

        {requests.length === 0 ? (
          <AdminEmptyState description="Public formlardan yeni lead geldiğinde burada listelenir.">
            Henüz public demo talebi yok.
          </AdminEmptyState>
        ) : filteredRequests.length === 0 ? (
          <AdminEmptyState
            description="Filtreleri gevşetin veya temizleyin."
            action={
              <Link href={basePath} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">
                Filtreleri temizle
              </Link>
            }
          >
            Seçili filtrelerle eşleşen kayıt yok.
          </AdminEmptyState>
        ) : (
          <>
            <div className="hidden lg:block">
              <DemoRequestTable requests={filteredRequests} filters={filters} basePath={basePath} />
            </div>
            <div className="space-y-4 lg:hidden">
              {filteredRequests.map((request) => (
                <DemoRequestCard
                  key={request.id}
                  request={request}
                  detailHref={leadDetailHref(filters, basePath, request.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <AdminDetailDrawer
        open={Boolean(selected)}
        title={selected ? readDemoMeta(selected.metadataJson).fullName || "Lead detayı" : "Lead detayı"}
        subtitle={selected ? readDemoMeta(selected.metadataJson).company || undefined : undefined}
        closeHref={closeHref}
        footer={
          selected ? (
            <div className="flex flex-wrap gap-2">
              <QuickActionLink
                href={
                  readDemoMeta(selected.metadataJson).email
                    ? `mailto:${readDemoMeta(selected.metadataJson).email}`
                    : "#"
                }
                label="E-posta"
                disabled={!readDemoMeta(selected.metadataJson).email}
              />
              <QuickActionLink
                href={
                  readDemoMeta(selected.metadataJson).phone
                    ? `tel:${readDemoMeta(selected.metadataJson).phone!.replace(/\s/g, "")}`
                    : "#"
                }
                label="Telefon"
                disabled={!readDemoMeta(selected.metadataJson).phone}
              />
            </div>
          ) : null
        }
      >
        {selected ? <LeadDetailBody request={selected} returnTo={returnTo} /> : null}
      </AdminDetailDrawer>
    </AdminPanel>
  );
}

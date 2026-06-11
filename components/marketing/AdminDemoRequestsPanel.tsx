import Link from "next/link";
import {
  AdminEmptyState,
  AdminPanel,
  AdminSectionTitle,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
} from "@/components/marketing/WexonAdminCards";
import { formatAdminDate } from "@/lib/wexon-admin";
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

type DemoRequestRow = {
  id: string;
  createdAt: Date;
  metadataJson: unknown;
};

export type AdminDemoRequestFilters = {
  product?: string;
  source?: string;
};

const demoProducts = ["WexPay", "WexHotel", "WexB2B", "Wexon Core"] as const;

const demoSourceOptions = [
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

function filterDemoRequests(requests: DemoRequestRow[], filters: AdminDemoRequestFilters) {
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

function DemoRequestCard({ request }: { request: DemoRequestRow }) {
  const meta = readDemoMeta(request.metadataJson);
  const source = resolveSource(meta);
  const email = meta.email?.trim();
  const phone = meta.phone?.trim();

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-slate-950">{meta.fullName ?? "—"}</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-600">{meta.company ?? "—"}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{formatAdminDate(request.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoBadge className={productBadgeClass(meta.product)}>{meta.product ?? "—"}</DemoBadge>
          <DemoBadge className={sourceBadgeClass(source.key)}>{source.label}</DemoBadge>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{meta.message ?? "—"}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <QuickActionLink href={email ? `mailto:${email}` : "#"} label="E-posta" disabled={!email} />
        <QuickActionLink href={phone ? `tel:${phone.replace(/\s/g, "")}` : "#"} label="Telefon" disabled={!phone} />
      </div>

      <div className="mt-3 space-y-1 text-xs font-semibold text-slate-500">
        <p className="truncate">{email ?? "—"}</p>
        <p className="truncate">{phone ?? "—"}</p>
      </div>
    </article>
  );
}

export default function AdminDemoRequestsPanel({
  requests,
  filters,
}: {
  requests: DemoRequestRow[];
  filters: AdminDemoRequestFilters;
}) {
  const filteredRequests = filterDemoRequests(requests, filters);
  const wexPayCount = requests.filter((request) => readDemoMeta(request.metadataJson).product === "WexPay").length;
  const linksCount = requests.filter((request) => resolveSource(readDemoMeta(request.metadataJson)).key === "links").length;
  const demoSourceCount = requests.filter(
    (request) => resolveSource(readDemoMeta(request.metadataJson)).key === "wexpay-demo",
  ).length;
  const hasActiveFilter =
    (filters.product && filters.product !== "all") || (filters.source && filters.source !== "all");

  return (
    <AdminPanel>
      <AdminSectionTitle
        badge="Demo"
        title="Public demo talepleri"
        description="WexPay demo, /links ve demo-request formundan gelen lead kayıtları. En yeni talepler üstte listelenir."
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Toplam talep" value={requests.length} />
        <AdminSummaryCard label="WexPay" value={wexPayCount} />
        <AdminSummaryCard label="WexPay Links" value={linksCount} />
        <AdminSummaryCard label="WexPay Demo" value={demoSourceCount} />
      </section>

      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-end">
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
            href="/admin/support"
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
          </div>

          <div className="hidden lg:block">
            <AdminTableShell>
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-5 py-4 font-bold">Tarih</th>
                    <th className="px-5 py-4 font-bold">Ad soyad</th>
                    <th className="px-5 py-4 font-bold">Firma</th>
                    <th className="px-5 py-4 font-bold">E-posta</th>
                    <th className="px-5 py-4 font-bold">Telefon</th>
                    <th className="px-5 py-4 font-bold">Ürün</th>
                    <th className="px-5 py-4 font-bold">Kaynak</th>
                    <th className="px-5 py-4 font-bold">Kullanım amacı / not</th>
                    <th className="px-5 py-4 font-bold">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((request) => {
                    const meta = readDemoMeta(request.metadataJson);
                    const source = resolveSource(meta);
                    const email = meta.email?.trim();
                    const phone = meta.phone?.trim();

                    return (
                      <tr key={request.id} className="align-top">
                        <td className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500">
                          {formatAdminDate(request.createdAt)}
                        </td>
                        <td className="max-w-[140px] px-5 py-4">
                          <p className="break-words font-black text-slate-950">{meta.fullName ?? "—"}</p>
                        </td>
                        <td className="max-w-[160px] px-5 py-4">
                          <p className="break-words font-semibold text-slate-700">{meta.company ?? "—"}</p>
                        </td>
                        <td className="max-w-[180px] px-5 py-4">
                          <p className="break-all text-xs font-semibold text-slate-600">{email ?? "—"}</p>
                        </td>
                        <td className="max-w-[140px] px-5 py-4">
                          <p className="break-words text-xs font-semibold text-slate-600">{phone ?? "—"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <DemoBadge className={productBadgeClass(meta.product)}>{meta.product ?? "—"}</DemoBadge>
                        </td>
                        <td className="px-5 py-4">
                          <DemoBadge className={sourceBadgeClass(source.key)}>{source.label}</DemoBadge>
                        </td>
                        <td className="max-w-[280px] px-5 py-4">
                          <p className="line-clamp-3 break-words text-sm leading-relaxed text-slate-600">
                            {meta.message ?? "—"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex min-w-[120px] flex-col gap-2">
                            <QuickActionLink href={email ? `mailto:${email}` : "#"} label="E-posta" disabled={!email} />
                            <QuickActionLink
                              href={phone ? `tel:${phone.replace(/\s/g, "")}` : "#"}
                              label="Telefon"
                              disabled={!phone}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AdminTableShell>
          </div>

          <div className="space-y-4 lg:hidden">
            {filteredRequests.map((request) => (
              <DemoRequestCard key={request.id} request={request} />
            ))}
          </div>
        </>
      )}
    </AdminPanel>
  );
}

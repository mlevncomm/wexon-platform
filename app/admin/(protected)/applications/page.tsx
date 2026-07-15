import Link from "next/link";
import AdminDemoRequestsPanel from "@/components/marketing/AdminDemoRequestsPanel";
import {
  AdminPageHeader,
  AdminStatGrid,
  AdminSummaryCard,
} from "@/components/marketing/WexonAdminCards";
import { getAdminDemoRequestsData } from "@/lib/wexon-admin";
import { buildWexPayEligibilityAdminView } from "@/lib/wexpay-eligibility-admin-display";
import { resolveFollowUpDateState } from "@/lib/wexon-demo-request-leads";

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    demoProduct?: string;
    demoSource?: string;
    demoStatus?: string;
    demoReview?: string;
    demoFollowUp?: string;
    q?: string;
    leadId?: string;
  }>;
}) {
  const params = await searchParams;
  const { requests } = await getAdminDemoRequestsData();
  const applicationRequests = requests.filter((request) => {
    const meta =
      typeof request.metadataJson === "object" && request.metadataJson !== null
        ? (request.metadataJson as { source?: string })
        : {};
    return meta.source === "on-basvuru";
  });

  const now = new Date().getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const followUpDue = applicationRequests.filter((request) => {
    const state = resolveFollowUpDateState(request.followUp.followUpAt);
    return state === "today" || state === "overdue";
  }).length;
  const manualReview = applicationRequests.filter(
    (request) => buildWexPayEligibilityAdminView(request.metadataJson).reviewStatusRaw === "manual_review",
  ).length;
  const wexPayCount = applicationRequests.filter((request) => {
    const meta =
      typeof request.metadataJson === "object" && request.metadataJson !== null
        ? (request.metadataJson as { product?: string })
        : {};
    return meta.product === "WexPay";
  }).length;
  const lastWeek = applicationRequests.filter((request) => now - request.createdAt.getTime() <= sevenDaysMs).length;

  return (
    <div className="space-y-5 sm:space-y-8">
      <AdminPageHeader
        badge="Ön Başvurular"
        title="Ön başvuru çalışma alanı"
        description="Satış ve başvuru kayıtlarını durum, takip ve uygunluk bilgileriyle yönetin."
        actions={
          <>
            <Link
              href="/admin/applications"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Yenile
            </Link>
            <Link
              href="/admin/support"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Destek masası
            </Link>
          </>
        }
      />

      <AdminStatGrid>
        <AdminSummaryCard label="Toplam" value={applicationRequests.length} helper="on-basvuru kaynaklı kayıtlar" />
        <AdminSummaryCard
          label="Yeni"
          value={applicationRequests.filter((request) => request.leadStatus === "new").length}
          helper="Henüz iletişime geçilmeyen"
        />
        <AdminSummaryCard label="Takip bekleyen" value={followUpDue} helper="Bugün veya gecikmiş takip" tone="warning" />
        <AdminSummaryCard label="WexPay" value={wexPayCount} helper="WexPay ürün ilgisi" />
        <AdminSummaryCard label="Manuel inceleme" value={manualReview} helper="Eligibility review" tone="warning" />
        <AdminSummaryCard label="Son 7 gün" value={lastWeek} helper="Yeni başvurular" />
        <AdminSummaryCard
          label="Kazanılan"
          value={applicationRequests.filter((request) => request.leadStatus === "won").length}
          helper="Kazanıldı durumu"
          tone="success"
        />
        <AdminSummaryCard
          label="Kaybedildi"
          value={applicationRequests.filter((request) => request.leadStatus === "lost").length}
          helper="Kaybedildi durumu"
        />
      </AdminStatGrid>

      <AdminDemoRequestsPanel
        requests={applicationRequests}
        filters={{
          product: params.demoProduct,
          source: params.demoSource ?? "on-basvuru",
          status: params.demoStatus,
          reviewStatus: params.demoReview,
          followUp: params.demoFollowUp,
          q: params.q,
          leadId: params.leadId,
        }}
        basePath="/admin/applications"
        title="Ön başvuru kayıtları"
        description="Bakım / ön başvuru sayfasından gelen kayıtlar. Detay paneli ile durum ve takip güncelleyin."
        showSummaryCards={false}
      />
    </div>
  );
}

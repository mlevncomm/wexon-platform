import AdminDemoRequestsPanel from "@/components/marketing/AdminDemoRequestsPanel";
import { AdminSectionTitle, AdminSummaryCard } from "@/components/marketing/WexonAdminCards";
import { getAdminDemoRequestsData } from "@/lib/wexon-admin";

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ demoProduct?: string; demoSource?: string }>;
}) {
  const { demoProduct, demoSource } = await searchParams;
  const { requests } = await getAdminDemoRequestsData();
  const applicationRequests = requests.filter((request) => {
    const meta =
      typeof request.metadataJson === "object" && request.metadataJson !== null
        ? (request.metadataJson as { source?: string })
        : {};
    return meta.source === "on-basvuru";
  });

  return (
    <div className="space-y-8">
      <AdminSectionTitle
        badge="Ön Başvurular"
        title="Bakım modu başvuruları"
        description="Wexon ön başvuru sayfasından gelen işletme ve ürün taleplerini buradan takip edin."
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Toplam ön başvuru" value={applicationRequests.length} />
        <AdminSummaryCard label="Yeni kayıt" value={applicationRequests.filter((request) => request.leadStatus === "new").length} />
        <AdminSummaryCard label="İletişimde" value={applicationRequests.filter((request) => request.leadStatus === "contacted").length} />
        <AdminSummaryCard label="Kazanılan" value={applicationRequests.filter((request) => request.leadStatus === "won").length} />
      </section>

      <AdminDemoRequestsPanel
        requests={applicationRequests}
        filters={{
          product: demoProduct,
          source: demoSource ?? "on-basvuru",
        }}
        basePath="/admin/applications"
        title="Ön başvuru kayıtları"
        description="Bakım modu ön başvuru sayfasından gelen kayıtlar. En yeni talepler üstte listelenir."
      />
    </div>
  );
}

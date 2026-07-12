import { getPublicBranchMenu, resolvePublicTableByQr } from "@/lib/wexpay-read";
import QrCustomerApp from "@/components/qr-order/QrCustomerApp";
import QrErrorState from "@/components/qr-order/QrErrorState";

type PageProps = {
  params: Promise<{ qrCode: string }>;
};

/**
 * PUBLIC QR ordering page -> /wexpay/t/[qrCode].
 *
 * Unauthenticated diner view. Tenant + access are resolved from the table
 * qrCode through Wexon Core. Orders post to /api/wexpay/public/[qrCode]/order.
 * This page does not start PayTR checkout.
 */
export default async function PublicTablePage({ params }: PageProps) {
  const { qrCode } = await params;
  const resolution = await resolvePublicTableByQr(qrCode);

  if (!resolution) {
    return (
      <QrErrorState
        title="QR geçersiz"
        message="Bu QR koduna ait masa bulunamadı. Lütfen personelden yeni bir kod isteyin."
        hint="Kod silinmiş veya yanlış yazılmış olabilir."
      />
    );
  }

  if (!resolution.allowed) {
    return (
      <QrErrorState
        title="Restoran şu an kapalı"
        message="Bu masa için menü veya sipariş şu anda kullanılamıyor. Lütfen personel ile iletişime geçin."
        hint="Oturum kapalı veya ürün erişimi aktif değil olabilir."
      />
    );
  }

  const categories = await getPublicBranchMenu(resolution.organizationId, resolution.branch.id);

  return (
    <QrCustomerApp
      context={{
        qrCode,
        restaurantName: resolution.restaurant.name,
        branchName: resolution.branch.name,
        tableLabel: resolution.table.label,
        tableStatus: resolution.table.status,
      }}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        products: category.products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price: Number(product.price),
          currency: product.currency,
          imageUrl: product.imageUrl,
          isPopular: product.isPopular,
        })),
      }))}
    />
  );
}

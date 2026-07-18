import { getPublicBranchMenu, resolvePublicTableByQr } from "@/lib/wexpay-read";
import { toPublicMenuModifierGroups } from "@/lib/wexpay-order-pricing";
import QrCustomerApp from "@/components/qr-order/QrCustomerApp";
import QrErrorState from "@/components/qr-order/QrErrorState";

type PageProps = {
  params: Promise<{ qrCode: string }>;
  searchParams: Promise<{ paytr?: string; paymentId?: string }>;
};

/**
 * PUBLIC QR ordering page -> /wexpay/t/[qrCode].
 *
 * Unauthenticated diner view. Tenant + access are resolved from the table
 * qrCode through Wexon Core. Orders post to /api/wexpay/public/[qrCode]/order.
 * PayTR return lands on ?paytr=success|failed&paymentId=… and is handled client-side.
 */
export default async function PublicTablePage({ params, searchParams }: PageProps) {
  const { qrCode } = await params;
  const query = await searchParams;
  const paytr = query.paytr?.trim().toLowerCase();
  const initialPaytrReturn =
    paytr === "success" || paytr === "failed"
      ? { result: paytr as "success" | "failed", paymentId: query.paymentId?.trim() || null }
      : null;

  let resolution: Awaited<ReturnType<typeof resolvePublicTableByQr>> = null;
  try {
    resolution = await resolvePublicTableByQr(qrCode);
  } catch {
    return (
      <QrErrorState
        title="Bağlantı hatası"
        message="Menü şu anda yüklenemedi. Lütfen bağlantınızı kontrol edip tekrar deneyin."
        hint="Sorun sürerse personelden yardım isteyin."
      />
    );
  }

  if (!resolution) {
    return (
      <QrErrorState
        title="QR geçersiz"
        message="Bu QR koduna ait masa bulunamadı. Lütfen personelden yeni bir kod isteyin."
        hint="Kod silinmiş, pasif veya yanlış olabilir."
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

  let categories: Awaited<ReturnType<typeof getPublicBranchMenu>> = [];
  try {
    categories = await getPublicBranchMenu(resolution.organizationId, resolution.branch.id);
  } catch {
    return (
      <QrErrorState
        title="Bağlantı hatası"
        message="Menü yüklenirken bir sorun oluştu. Lütfen kısa süre sonra tekrar deneyin."
      />
    );
  }

  return (
    <QrCustomerApp
      context={{
        qrCode,
        restaurantName: resolution.restaurant.name,
        branchName: resolution.branch.name,
        tableLabel: resolution.table.label,
        tableStatus: resolution.table.status,
      }}
      initialPaytrReturn={initialPaytrReturn}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        products: category.products.map((product) => {
          const modifierGroups = toPublicMenuModifierGroups(
            product.productModifierGroups?.map((link) => ({
              groupId: link.groupId,
              sortOrder: link.sortOrder,
              isActive: link.isActive,
              group: link.group,
            })),
          );
          return {
            id: product.id,
            name: product.name,
            description: product.description,
            price: Number(product.price),
            currency: product.currency,
            imageUrl: product.imageUrl,
            isPopular: product.isPopular,
            ...(modifierGroups.length > 0 ? { modifierGroups } : {}),
          };
        }),
      }))}
    />
  );
}

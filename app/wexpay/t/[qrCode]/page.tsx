import { getPublicBranchMenu, resolvePublicTableByQr } from "@/lib/wexpay-read";
import WexPayPublicOrderClient from "@/components/wexpay/WexPayPublicOrderClient";

type PageProps = { params: Promise<{ qrCode: string }> };

/**
 * PUBLIC QR ordering page -> /wexpay/t/[qrCode].
 *
 * Unauthenticated diner view. Tenant + access are resolved from the table
 * qrCode through Wexon Core; the menu is read-only here. Order placement runs
 * through POST /api/wexpay/public/[qrCode]/order with server-side subtotal calculation.
 */
export default async function PublicTablePage({ params }: PageProps) {
  const { qrCode } = await params;
  const resolution = await resolvePublicTableByQr(qrCode);

  if (!resolution || !resolution.allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
          </span>
          <h1 className="text-lg font-black text-slate-950">QR menü kullanılamıyor</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
            Bu masa için menü şu anda görüntülenemiyor. Lütfen personel ile iletişime geçin.
          </p>
        </div>
      </main>
    );
  }

  const categories = await getPublicBranchMenu(resolution.organizationId, resolution.branch.id);

  return (
    <main className="min-h-screen overflow-x-clip bg-[#f6f8f7] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-5 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">WexPay · QR Menü</p>
          <h1 className="break-words text-2xl font-black tracking-[-0.03em] text-slate-950">{resolution.restaurant.name}</h1>
          <p className="text-sm font-semibold text-slate-500">
            {resolution.branch.name} · {resolution.table.label}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        {categories.length === 0 ? (
          <div className="rounded-[26px] border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            Bu şubede şu anda görüntülenecek menü bulunmuyor.
          </div>
        ) : (
          <WexPayPublicOrderClient
            qrCode={qrCode}
            categories={categories.map((category) => ({
              id: category.id,
              name: category.name,
              products: category.products.map((product) => ({
                id: product.id,
                name: product.name,
                description: product.description,
                price: Number(product.price),
                currency: product.currency,
              })),
            }))}
          />
        )}

        <p className="px-1 text-center text-xs font-semibold leading-relaxed text-slate-400">
          Tutarlar sipariş gönderiminde sunucu tarafında tekrar hesaplanır. Personeliniz siparişi operasyon panelinden takip eder.
        </p>
      </div>
    </main>
  );
}

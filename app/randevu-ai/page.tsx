import type { Metadata } from "next";
import Link from "next/link";
import WexonLeadPage from "@/components/marketing/WexonLeadPage";
import type { LeadField } from "@/components/marketing/WexonLeadPage";
import { PublicFeatureGrid } from "@/components/marketing/PublicMarketingBlocks";

export const metadata: Metadata = {
  title: "Randevu AI",
  description:
    "Wexon Randevu AI yakında: planlama ve görüşme süreçlerini kolaylaştırmayı hedefler. Bugün demo veya randevu talebi bırakabilirsiniz.",
  alternates: { canonical: "/randevu-ai" },
};

const fields: LeadField[] = [
  { name: "fullName", label: "Ad soyad" },
  { name: "company", label: "Firma adı" },
  { name: "email", label: "E-posta", type: "email" },
  { name: "phone", label: "Telefon", type: "tel" },
  { name: "product", label: "Görüşmek istediğiniz ürün", type: "select", options: ["WexPay Business Suite", "WexHotel", "WexB2B", "Wexon Core"] },
  { name: "preferredDate", label: "Tercih edilen tarih", type: "date" },
  { name: "preferredTime", label: "Tercih edilen saat", type: "time" },
  { name: "note", label: "Not", type: "textarea" },
];

const vision = [
  {
    title: "Görüşme planlama",
    description: "Uygun zaman önerileri ve randevu taleplerini tek akışta toplamak.",
  },
  {
    title: "Ürün yönlendirme",
    description: "WexPay Business Suite, Core veya roadmap ürünlerine doğru eşleştirme.",
  },
  {
    title: "İnsan onayı",
    description: "Otomasyon destekli; nihai planlama Wexon ekibi onayıyla ilerler.",
  },
];

export default function RandevuAiPage() {
  return (
    <WexonLeadPage
      badge="Randevu AI · Yakında"
      headline="Randevu AI yakında; bugün demo görüşmesi planlayın"
      description="Randevu AI, planlama yükünü azaltmayı hedefler. Canlı AI randevu motoru henüz yayında değildir — talebinizi alıp uygunluk durumuna göre dönüş yaparız."
      fields={fields}
      submitLabel="Randevu Talebi Gönder"
      successMessage="Randevu talebiniz alındı. Uygunluk durumuna göre sizinle iletişime geçeceğiz."
      sideTitle="Bugün ne olur?"
      sideItems={[
        "Talebiniz kaydedilir",
        "Ürün ihtiyacınız değerlendirilir",
        "Uygun bir görüşme penceresi önerilir",
        "Demo veya ön başvuru sonraki adım olabilir",
      ]}
      formTitle="Görüşme talebi oluşturun"
      formDescription="Tercih ettiğiniz tarih/saat ve ürünü seçin. Bu form kesin rezervasyon değildir."
      formNote="Randevu AI yayına girdiğinde bu sayfa güncellenecektir. Şimdilik manuel planlama geçerlidir."
    >
      <section className="mt-14">
        <h2 className="mb-6 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Ne çözmeyi hedefliyoruz?</h2>
        <PublicFeatureGrid items={vision} />
      </section>

      <section className="mt-14 rounded-3xl border border-slate-900 bg-slate-950 p-8 text-center text-white sm:p-12">
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Demo veya ön başvuru ile başlayın</h2>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/demo-request"
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white hover:bg-emerald-400"
          >
            Demo Talep Et
          </Link>
          <Link
            href="/on-basvuru"
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/10"
          >
            Ön Başvuru
          </Link>
        </div>
      </section>
    </WexonLeadPage>
  );
}

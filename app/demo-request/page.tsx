import Link from "next/link";
import WexonLeadPage from "@/components/marketing/WexonLeadPage";
import type { LeadField } from "@/components/marketing/WexonLeadPage";

const fields: LeadField[] = [
  { name: "fullName", label: "Ad soyad" },
  { name: "company", label: "Firma adı" },
  { name: "email", label: "E-posta", type: "email" },
  { name: "phone", label: "Telefon", type: "tel" },
  { name: "product", label: "İlgilendiğiniz ürün", type: "select", options: ["WexPay", "WexHotel", "WexB2B", "Wexon Core"] },
  { name: "businessType", label: "İşletme tipi" },
  { name: "branchCount", label: "Şube sayısı" },
  { name: "message", label: "Mesaj", type: "textarea" },
];

export default function DemoRequestPage() {
  const demoCards = [
    "WexPay müşteri QR deneyimi",
    "WexPay işletme paneli",
    "Menü, sipariş ve ödeme akışı",
    "Masa, fiş ve rapor takibi",
    "Wexon Core lisans yapısı",
    "Paket ve kurulum planı",
  ];

  return (
    <WexonLeadPage
      badge="Demo Talebi"
      headline="Wexon ürünleri için demo talep edin"
      description="WexPay başta olmak üzere Wexon ekosistemindeki ürünleri işletmenize göre nasıl kullanabileceğinizi birlikte planlayalım."
      fields={fields}
      submitLabel="Demo Talebi Gönder"
      successMessage="Demo talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz."
      sideTitle="Demo görüşmesinde neleri gösteriyoruz?"
      sideItems={["Canlı WexPay demo akışı", "İşletme tipine göre ürün önerisi", "Paket ve lisans değerlendirmesi", "Kurulum yol haritası"]}
      formTitle="Demo talebinizi oluşturun"
      formDescription="İletişim ve işletme bilgilerinizi paylaşın; Wexon ekibi size en uygun demo akışını hazırlasın."
      formNote="Bu form şu anda ön talep akışı içindir. Gerçek kayıt ve CRM bağlantısı Wexon Core tamamlandığında eklenecektir."
    >
      <section className="mt-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
            Demo İçeriği
          </span>
          <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
            Demo görüşmesinde neleri gösteriyoruz?
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {demoCards.map((card) => (
            <div key={card} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
              <div className="mb-4 h-2 w-10 rounded-full bg-emerald-500" />
              <p className="text-base font-bold text-slate-950">{card}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-[32px] border border-slate-900 bg-slate-950 p-8 text-center text-white shadow-2xl shadow-slate-950/20 sm:p-12">
        <h2 className="text-3xl font-black tracking-[-0.02em] sm:text-4xl">Randevuya hazır mısınız?</h2>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/book-demo" className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white hover:bg-emerald-400">
            Randevu Al
          </Link>
          <Link href="/products/wexpay" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/10">
            WexPay&apos;i İncele
          </Link>
        </div>
      </section>
    </WexonLeadPage>
  );
}

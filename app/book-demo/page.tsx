import Link from "next/link";
import WexonLeadPage from "@/components/marketing/WexonLeadPage";
import type { LeadField } from "@/components/marketing/WexonLeadPage";

const fields: LeadField[] = [
  { name: "fullName", label: "Ad soyad" },
  { name: "company", label: "Firma adı" },
  { name: "email", label: "E-posta", type: "email" },
  { name: "phone", label: "Telefon", type: "tel" },
  { name: "product", label: "Görüşmek istediğiniz ürün", type: "select", options: ["WexPay", "WexHotel", "WexB2B", "Wexon Core"] },
  { name: "preferredDate", label: "Tercih edilen tarih", type: "date" },
  { name: "preferredTime", label: "Tercih edilen saat", type: "time" },
  { name: "note", label: "Not", type: "textarea" },
];

export default function BookDemoPage() {
  const steps = [
    "Talebinizi alırız",
    "İşletme ihtiyacınızı değerlendiririz",
    "WexPay canlı demo akışını gösteririz",
    "Paket, lisans ve kurulum önerisini paylaşırız",
  ];
  const audiences = [
    "Restoranlar",
    "Kafeler",
    "Çok şubeli işletmeler",
    "Otel ve konaklama işletmeleri",
    "B2B satış yapan firmalar",
  ];

  return (
    <WexonLeadPage
      badge="Randevu Al"
      headline="Wexon demo görüşmesi planlayın"
      description="İşletmeniz için WexPay ve Wexon Core yapısını birlikte değerlendirelim."
      fields={fields}
      submitLabel="Randevu Talebi Gönder"
      successMessage="Randevu talebiniz alındı. Uygunluk durumuna göre sizinle iletişime geçeceğiz."
      sideTitle="Demo görüşmesi içeriği"
      sideItems={["WexPay restoran/kafe demo akışı", "Wexon Core lisans ve paket yaklaşımı", "İşletmenize uygun kullanım senaryoları", "Sonraki adımlar ve ürün yol haritası"]}
      formTitle="Randevu talebinizi oluşturun"
      formDescription="Uygun tarih ve görüşmek istediğiniz ürünü seçin; Wexon ekibi uygunluk durumuna göre size dönüş yapsın."
      formNote="Randevu talebi kesin rezervasyon değildir. Uygunluk durumuna göre sizinle iletişime geçilecektir."
    >
      <section className="mt-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
            Görüşme Süreci
          </span>
          <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
            Görüşme süreci nasıl ilerler?
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-sm font-black text-emerald-700">{index + 1}</span>
              <p className="mt-5 text-sm font-bold leading-relaxed text-slate-950">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
            Uygun İşletmeler
          </span>
          <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
            Kimler için uygun?
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {audiences.map((audience) => (
            <div key={audience} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
              <div className="mb-4 h-2 w-10 rounded-full bg-emerald-500" />
              <p className="text-sm font-bold text-slate-950">{audience}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-[32px] border border-slate-900 bg-slate-950 p-8 text-center text-white shadow-2xl shadow-slate-950/20 sm:p-12">
        <h2 className="text-3xl font-black tracking-[-0.02em] sm:text-4xl">Ön başvuru yaparak süreci hızlandırın</h2>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/apply" className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white hover:bg-emerald-400">
            Ön Başvuru Yap
          </Link>
          <Link href="/demo-request" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/10">
            Demo Talep Et
          </Link>
        </div>
      </section>
    </WexonLeadPage>
  );
}

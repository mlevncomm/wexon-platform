import Link from "next/link";
import WexonLeadPage from "@/components/marketing/WexonLeadPage";
import type { LeadField } from "@/components/marketing/WexonLeadPage";

const fields: LeadField[] = [
  { name: "company", label: "Firma adı" },
  { name: "contactName", label: "Yetkili kişi" },
  { name: "email", label: "E-posta", type: "email" },
  { name: "phone", label: "Telefon", type: "tel" },
  { name: "sector", label: "Sektör" },
  { name: "branchCount", label: "Şube sayısı" },
  { name: "product", label: "İlgilendiğiniz ürün", type: "select", options: ["WexPay", "WexHotel", "WexB2B", "Tüm Wexon ekosistemi"] },
  { name: "note", label: "Not", type: "textarea" },
];

export default function ApplyPage() {
  const steps = [
    "İşletme bilgilerinizi inceleriz",
    "Uygun ürün ve paket yapısını belirleriz",
    "Canlı demo veya randevu planlarız",
    "Wexon Core ve WexPay kurulum yol haritasını çıkarırız",
  ];
  const products = [
    "WexPay: restoran ve kafeler için aktif ürün",
    "WexHotel: otel yönetimi için yakında",
    "WexB2B: bayi ve toptan satış için yakında",
  ];

  return (
    <WexonLeadPage
      badge="Ön Başvuru"
      headline="Wexon ekosistemine katılmak için ön başvuru yapın"
      description="İşletmenizin ihtiyaçlarını öğrenelim, size en uygun Wexon ürün ve lisans yapısını birlikte belirleyelim."
      fields={fields}
      submitLabel="Ön Başvuruyu Gönder"
      successMessage="Ön başvurunuz alındı. Wexon ekibi sizinle iletişime geçecek."
      sideTitle="Ön başvuru sonrası süreç"
      sideItems={["İşletme ihtiyacınız değerlendirilir", "Ürün ve lisans yapısı netleştirilir", "WexPay demo akışı planlanır", "Uygun yol haritası sizinle paylaşılır"]}
      formTitle="Ön başvuru bilgileri"
      formDescription="İşletmenizi ve ilgilendiğiniz Wexon ürününü paylaşın; uygun ürün ve lisans yaklaşımını birlikte netleştirelim."
      formNote="Ön başvuru, gerçek hesap oluşturma değildir. Wexon ekibi başvuruyu değerlendirdikten sonra sizinle iletişime geçer."
    >
      <section className="mt-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
            Başvuru Süreci
          </span>
          <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
            Başvuru sonrası süreç
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
            Ürün Seçimi
          </span>
          <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
            Hangi ürünle başlamalısınız?
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {products.map((product) => (
            <div key={product} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
              <div className="mb-4 h-2 w-10 rounded-full bg-[#5dff65]" />
              <p className="text-sm font-bold leading-relaxed text-slate-950">{product}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-[32px] border border-slate-900 bg-slate-950 p-8 text-center text-white shadow-2xl shadow-slate-950/20 sm:p-12">
        <h2 className="text-3xl font-black tracking-[-0.02em] sm:text-4xl">Karar vermeden önce canlı demo izleyin</h2>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/demo/wexpay/business" className="inline-flex items-center justify-center rounded-full bg-[#5dff65] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#48e050]">
            Canlı WexPay Demosu
          </Link>
          <Link href="/demo-request" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/10">
            Demo Talep Et
          </Link>
        </div>
      </section>
    </WexonLeadPage>
  );
}

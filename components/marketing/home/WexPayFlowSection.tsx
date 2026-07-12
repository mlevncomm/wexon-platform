import { WEXPAY_FLOW_STEPS } from "@/lib/wexon-home-content";
import SectionShell from "@/components/ui/SectionShell";
import Button from "@/components/ui/Button";
import PhoneFrame from "@/components/ui/PhoneFrame";
import SectionHeading from "./SectionHeading";
import { WexonIcon } from "./icons";

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[19rem] overflow-x-clip pb-8">
      <PhoneFrame>
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-bold text-slate-300">
            <span>WexPay</span>
            <span>Masa 4</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <WexonIcon name="qr" size={18} className="text-emerald-600" />
            <span className="text-[12px] font-bold text-emerald-800">Menü QR ile açıldı</span>
          </div>

          <div className="space-y-2">
            {[
              { name: "Köfte porsiyon", qty: "x1", price: "₺180" },
              { name: "Ayran", qty: "x2", price: "₺60" },
              { name: "Künefe", qty: "x1", price: "₺120" },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2"
              >
                <span className="text-[12px] font-semibold text-slate-700">
                  {item.name} <span className="text-slate-400">{item.qty}</span>
                </span>
                <span className="text-[12px] font-bold text-slate-900">{item.price}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-[12px] font-bold text-slate-500">Toplam</span>
            <span className="text-[14px] font-black text-slate-950">₺360</span>
          </div>

          <div className="rounded-xl bg-emerald-500 px-3 py-2.5 text-center text-[13px] font-bold text-white">
            Ödemeyi tamamla
          </div>
        </div>
      </PhoneFrame>

      <div className="absolute bottom-0 right-0 w-[min(190px,85%)] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_24px_48px_-20px_rgba(2,44,34,0.4)] sm:-right-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Restoran paneli</p>
        <div className="mt-1.5 flex items-start gap-2">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <p className="text-[12px] font-bold leading-snug text-slate-900">
            Masa 4 ödeme tamamladı · ₺360
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WexPayFlowSection() {
  return (
    <SectionShell tone="white" width="wide">
      <SectionHeading
        eyebrow="WexPay akışı"
        title={
          <>
            Tek QR ile siparişten ödemeye{" "}
            <span className="text-emerald-600">kesintisiz restoran deneyimi</span>
          </>
        }
        subtitle="Müşteri menüyü görüntüler, sepetini oluşturur, siparişini gönderir ve ödemesini tamamlar. Restoran tarafında masa, ödeme ve fiş talepleri canlı takip edilir."
      />

      <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {WEXPAY_FLOW_STEPS.map((step) => {
            const isBusiness = step.side === "business";
            return (
              <li
                key={step.step}
                className={`wx-lift flex items-start gap-3 rounded-2xl border p-4 ${
                  isBusiness
                    ? "border-slate-900 bg-slate-950 text-white shadow-[0_24px_54px_-28px_rgba(2,44,34,0.6)] sm:col-span-2"
                    : "border-slate-200 bg-white hover:border-emerald-200"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                    isBusiness ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {step.step}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <WexonIcon
                      name={step.icon}
                      size={15}
                      className={isBusiness ? "text-emerald-300" : "text-emerald-500"}
                    />
                    <h3 className={`text-[15px] font-bold ${isBusiness ? "text-white" : "text-slate-950"}`}>
                      {step.title}
                    </h3>
                  </div>
                  <p className={`mt-1 text-[13px] leading-relaxed ${isBusiness ? "text-slate-300" : "text-slate-600"}`}>
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="pb-6 lg:pb-0">
          <PhoneMockup />
          <div className="mt-10 flex justify-center lg:mt-12">
            <Button href="/demo-request?product=wexpay" variant="onDark" withArrow className="bg-slate-950 text-white hover:bg-slate-800">
              QR müşteri deneyimi için başvur
            </Button>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

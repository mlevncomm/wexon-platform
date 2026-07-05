const PRIMARY_PILLS: { label: string; emphasized?: boolean }[] = [
  { label: "WexPay", emphasized: true },
  { label: "Wexon Core" },
  { label: "QR Menü" },
  { label: "Masa Yönetimi" },
];

const SECONDARY_PILLS: { label: string }[] = [
  { label: "Lisans Yönetimi" },
  { label: "Abonelik" },
  { label: "Raporlama" },
  { label: "Sanal POS Entegrasyonu" },
];

function Pill({ label, emphasized = false }: { label: string; emphasized?: boolean }) {
  if (emphasized) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#5dff65] px-4 py-2 text-sm font-bold text-white shadow-sm shadow-[#5dff65]/30">
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm shadow-slate-200/40 transition-colors hover:border-emerald-200 hover:text-slate-950">
      <span className="h-1.5 w-1.5 rounded-full bg-[#5dff65]" />
      {label}
    </span>
  );
}

export default function WexonTrustStrip() {
  return (
    <section className="bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16 2xl:px-20">
      <div className="mx-auto max-w-[1480px]">
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          Wexon ekosistemi tek altyapıda büyür
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {PRIMARY_PILLS.map((p) => (
            <Pill key={p.label} label={p.label} emphasized={p.emphasized} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {SECONDARY_PILLS.map((p) => (
            <Pill key={p.label} label={p.label} />
          ))}
        </div>

        <p className="mt-9 text-center text-sm text-slate-500">
          Tek lisans · tek müşteri · tek fatura altyapısı
        </p>
      </div>
    </section>
  );
}

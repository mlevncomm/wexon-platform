"use client";

import { useState } from "react";
import type { ProductId } from "@/types/wexon";
import { WEXB2B_APP, WEXHOTEL_APP, WEXPAY_APP } from "@/lib/wexon-home-content";
import SectionShell from "@/components/ui/SectionShell";
import SectionHeading from "./SectionHeading";
import WexPayPreview from "./preview/WexPayPreview";
import WexHotelPreview from "./preview/WexHotelPreview";
import WexB2BPreview from "./preview/WexB2BPreview";

const TABS: { id: ProductId; label: string; activeCls: string }[] = [
  { id: "wexpay", label: "WexPay", activeCls: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30" },
  { id: "wexhotel", label: "WexHotel", activeCls: "bg-indigo-500 text-white shadow-sm shadow-indigo-500/30" },
  { id: "wexb2b", label: "WexB2B", activeCls: "bg-amber-500 text-white shadow-sm shadow-amber-500/30" },
];

export default function InteractiveDemoPreview() {
  const [active, setActive] = useState<ProductId>("wexpay");

  return (
    <SectionShell id="solutions" tone="subtle" width="wide">
      <SectionHeading
        eyebrow="Ürün ekranları"
        title={
          <>
            Her ürün kendi operasyon ekranına sahip,{" "}
            <span className="text-emerald-600">erişim kararları Wexon Core&apos;dan gelir</span>
          </>
        }
        subtitle="WexPay, WexHotel ve WexB2B kendi operasyon panelinde çalışır; lisans, abonelik ve erişim ise merkezi olarak Wexon Core üzerinden yönetilir."
      />

      <div className="mt-10 flex justify-center">
        <div
          role="tablist"
          aria-label="Ürün ekranları"
          className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_-24px_rgba(2,44,34,0.35)]"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(tab.id)}
                className={`wx-tactile rounded-full px-4 py-2 text-sm font-bold transition-colors sm:px-5 ${
                  isActive ? tab.activeCls : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-5xl">
        {active === "wexpay" && <WexPayPreview data={WEXPAY_APP} />}
        {active === "wexhotel" && <WexHotelPreview data={WEXHOTEL_APP} />}
        {active === "wexb2b" && <WexB2BPreview data={WEXB2B_APP} />}
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-500">
        Ekranlar örnek verilerle gösterilir; gerçek operasyonda veriler ilgili ürün ve Wexon Core üzerinden gelir.
      </p>
    </SectionShell>
  );
}

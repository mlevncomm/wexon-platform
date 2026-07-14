"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createDemoRequestAction } from "@/lib/wexon-public-actions";
import {
  initialDemoRequestState,
  type DemoRequestFormState,
} from "@/lib/wexon-demo-request-form-state";
import { normalizeDemoRequestSource } from "@/lib/wexon-public-validation";
import WexonInput from "@/components/marketing/WexonInput";
import WexonSelect from "@/components/marketing/WexonSelect";
import WexonTextarea from "@/components/marketing/WexonTextarea";

const DEFAULT_PRODUCT_OPTIONS = ["WexPay", "WexHotel", "WexB2B", "Wexon Core"];

type DemoRequestMode = "demo" | "application";

function SubmitButton({
  pending,
  mode,
  eligibilityMode,
  minimal,
}: {
  pending: boolean;
  mode: DemoRequestMode;
  eligibilityMode?: boolean;
  minimal?: boolean;
}) {
  const label = eligibilityMode
    ? "Uygunluğunu Kontrol Et"
    : mode === "application"
      ? "Ön Başvuru Gönder"
      : "Demo Talebi Gönder";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex w-full items-center justify-center rounded-full bg-[#10b981] px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70 ${
        minimal ? "" : "shadow-sm shadow-emerald-500/20"
      }`}
    >
      {pending ? "Gönderiliyor..." : label}
    </button>
  );
}

function SuccessPanel({
  state,
  mode,
  minimal,
}: {
  state: DemoRequestFormState;
  mode: DemoRequestMode;
  minimal?: boolean;
}) {
  if (!state.submitted) return null;

  return (
    <div
      className={
        minimal
          ? "mb-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-6"
          : "mb-6 rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm shadow-emerald-100/60"
      }
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white ${
          minimal ? "" : "shadow-lg shadow-emerald-500/25"
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M5 12l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-xl font-black tracking-tight text-slate-950">Talebiniz alındı</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {state.applicantMessage ??
          (mode === "application"
            ? "Ön başvurunuz Wexon ekibine iletildi. En kısa sürede sizinle iletişime geçeceğiz."
            : "Demo talebiniz Wexon ekibine iletildi. En kısa sürede sizinle iletişime geçeceğiz.")}
      </p>
      <p className="mt-2 text-xs font-semibold text-slate-500">
        Öneri nihai ticari onay değildir; ekibimiz uygunluğu doğrular.
      </p>
      {mode === "demo" ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/book-demo"
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
          >
            Randevu Al
          </Link>
          <Link
            href="/products/wexpay"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            WexPay&apos;i İncele
          </Link>
        </div>
      ) : null}
    </div>
  );
}

type DemoRequestFormProps = {
  defaultProduct?: string;
  defaultSource?: string;
  defaultPlan?: string;
  intent?: string;
  mode?: DemoRequestMode;
  productOptions?: string[];
  appearance?: "default" | "minimal";
};

const SURFACE_CLASS = {
  default: "rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8",
  minimal: "rounded-[32px] border border-white/15 bg-white p-6 shadow-sm shadow-black/10 sm:p-8",
} as const;

export default function DemoRequestForm({
  defaultProduct,
  defaultSource,
  defaultPlan,
  intent,
  mode = "demo",
  productOptions = DEFAULT_PRODUCT_OPTIONS,
  appearance = "default",
}: DemoRequestFormProps) {
  const [state, formAction, pending] = useActionState(createDemoRequestAction, initialDemoRequestState);
  const sourceValue = normalizeDemoRequestSource(defaultSource);
  const selectedProduct =
    defaultProduct && productOptions.includes(defaultProduct) ? defaultProduct : undefined;
  const minimal = appearance === "minimal";
  const eligibilityMode = intent === "eligibility" || Boolean(defaultPlan);

  return (
    <section className={SURFACE_CLASS[appearance]}>
      <div className="mb-6">
        <span className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-700">
          Form
        </span>
        <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-950">
          {eligibilityMode
            ? "WexPay uygunluğunu kontrol edin"
            : mode === "application"
              ? "Ön başvuru bilgileri"
              : "Demo talebinizi oluşturun"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {eligibilityMode
            ? "Form öneri üretir; nihai paket onayı Wexon ekibi tarafından verilir. Dahili risk gerekçeleri paylaşılmaz."
            : mode === "application"
              ? "İletişim ve işletme bilgilerinizi paylaşın; Wexon ekibi başvurunuzu inceleyip sizinle iletişime geçsin."
              : "İletişim ve işletme bilgilerinizi paylaşın; size en uygun demo akışını hazırlayalım."}
        </p>
      </div>

      <SuccessPanel state={state} mode={mode} minimal={minimal} />

      {state.error || state.message ? (
        <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {state.message ?? state.error}
        </p>
      ) : null}

      {!state.submitted ? (
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="source" value={sourceValue} />
          {intent ? <input type="hidden" name="intent" value={intent} /> : null}
          {defaultPlan ? <input type="hidden" name="plan" value={defaultPlan} /> : null}
          {productOptions.length > 0 ? (
            <input type="hidden" name="_allowedProducts" value={productOptions.join("|")} />
          ) : null}
          <WexonInput name="fullName" label="Ad soyad" required />
          <WexonInput name="company" label="Firma adı" required />
          <WexonInput name="email" type="email" label="E-posta" required />
          <WexonInput name="phone" type="tel" label="Telefon" required />
          <div className="sm:col-span-2">
            <WexonSelect
              name="product"
              label="İlgilendiğiniz ürün"
              options={productOptions}
              defaultValue={selectedProduct ?? ""}
              required
            />
          </div>

          {eligibilityMode ? (
            <>
              <WexonSelect
                name="companyType"
                label="Şirket tipi"
                options={["limited", "anonim", "sahis", "diger"]}
                defaultValue=""
              />
              <WexonInput name="sector" label="Sektör" placeholder="Restoran, otel, perakende..." />
              <WexonSelect
                name="monthlyGmvBand"
                label="Aylık GMV bandı"
                options={["150k-750k", "750k-3m", "3m-15m", "15m+"]}
                defaultValue=""
              />
              <WexonInput name="locationCount" type="number" label="Lokasyon sayısı" defaultValue="1" />
              <WexonInput name="avgTicket" type="number" label="Ortalama sepet (₺)" />
              <WexonSelect
                name="onlineOfflineSplit"
                label="Online / offline dağılım"
                options={["cogunlukla_offline", "karma", "cogunlukla_online"]}
                defaultValue=""
              />
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" name="needsSubscriptions" className="h-4 w-4 rounded border-slate-300" />
                Abonelik / tekrarlayan tahsilat ihtiyacı
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" name="needsQr" className="h-4 w-4 rounded border-slate-300" defaultChecked />
                QR sipariş / ödeme ihtiyacı
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                <input type="checkbox" name="needsIntegration" className="h-4 w-4 rounded border-slate-300" />
                Özel entegrasyon / ERP ihtiyacı
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                <input type="checkbox" name="needsMarketplaceOrPayout" className="h-4 w-4 rounded border-slate-300" />
                Marketplace / split payout / fon dağıtımı talebi
              </label>
            </>
          ) : null}

          <div className="sm:col-span-2">
            <WexonTextarea name="message" rows={5} label="Kullanım amacı / not" required />
          </div>
          <p className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-relaxed text-slate-600">
            Talepler güvenli şekilde Wexon admin paneline kaydedilir. Canlı ödeme veya hesap otomatik açılmaz.
          </p>
          <div className="sm:col-span-2">
            <SubmitButton pending={pending} mode={mode} eligibilityMode={eligibilityMode} minimal={minimal} />
          </div>
        </form>
      ) : null}
    </section>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

const contactCards = [
  { title: "Demo talepleri", href: "/demo-request" },
  { title: "Randevu", href: "/book-demo" },
  { title: "Ön başvuru", href: "/apply" },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <WexonStaticPageShell
      badge="İletişim"
      headline="Wexon ekibiyle iletişime geçin"
      description="Demo, ön başvuru, iş ortaklığı veya genel sorularınız için bizimle iletişime geçebilirsiniz."
    >
      <section className="grid gap-5 lg:grid-cols-3">
        {contactCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <WexonInfoCard title={card.title} description="İlgili aksiyon sayfasına ilerleyin." />
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/60">
          <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-950">Statik iletişim bilgileri</h2>
          <div className="mt-6 space-y-4 text-sm font-semibold text-slate-600">
            <p>E-posta: info@wexon.dev</p>
            <p>Çalışma alanı: Türkiye</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
          <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-950">Mesaj gönderin</h2>
          {submitted && (
            <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              Mesajınız alındı. En kısa sürede sizinle iletişime geçeceğiz.
            </p>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {["Ad soyad", "E-posta", "Konu"].map((label) => (
              <label key={label} className={label === "Konu" ? "sm:col-span-2" : ""}>
                <span className="text-sm font-bold text-slate-700">{label}</span>
                <input className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400/40" />
              </label>
            ))}
            <label className="sm:col-span-2">
              <span className="text-sm font-bold text-slate-700">Mesaj</span>
              <textarea rows={5} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400/40" />
            </label>
            <button type="submit" className="sm:col-span-2 rounded-full bg-[#5dff65] px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-[#48e050]">
              Mesaj Gönder
            </button>
          </div>
        </form>
      </section>
    </WexonStaticPageShell>
  );
}

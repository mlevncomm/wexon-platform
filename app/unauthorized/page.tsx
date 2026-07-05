import Link from "next/link";
import WexonFooter from "@/components/marketing/WexonFooter";
import WexonNavbar from "@/components/marketing/WexonNavbar";

export default function UnauthorizedPage() {
  return (
    <>
      <WexonNavbar />
      <main className="min-h-screen bg-[#f6f8f7] px-5 pb-20 pt-24 text-slate-950 sm:px-8 md:pt-28">
        <section className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70 sm:p-12">
          <span className="mb-5 inline-flex rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-xs font-semibold text-rose-700">
            Yetkisiz erişim
          </span>
          <h1 className="text-4xl font-black tracking-[-0.02em] text-slate-950">Bu alana erişim yetkiniz yok</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-600">
            Wexon Admin Paneli yalnızca yetkilendirilmiş Wexon iç kullanıcıları için kullanılabilir.
          </p>
          <Link href="/" className="mt-8 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-emerald-700">
            Ana sayfaya dön
          </Link>
        </section>
      </main>
      <WexonFooter />
    </>
  );
}

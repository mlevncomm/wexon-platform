import type { ReactNode } from "react";
import WexonFooter from "@/components/marketing/WexonFooter";
import WexonNavbar from "@/components/marketing/WexonNavbar";

export default function WexonFormShell({
  children,
  after,
}: {
  children: ReactNode;
  after?: ReactNode;
}) {
  return (
    <>
      <WexonNavbar />
      <main className="min-h-screen bg-[#f6f8f7] px-5 pb-20 pt-24 text-slate-950 sm:px-8 md:pt-28 lg:px-12 xl:px-16 2xl:px-20">
        <div className="mx-auto max-w-[1360px]">
          {children}
          {after}
        </div>
      </main>
      <WexonFooter />
    </>
  );
}

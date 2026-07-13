"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { resolveNavigationHref } from "@/lib/wexon/urls";

const SERVICE_CARDS = [
  {
    title: "WexPay",
    body: "QR menü, masa, sipariş ve ödeme",
    href: "/products/wexpay",
    initials: "WP",
    badge: "Pilot",
  },
  {
    title: "Wexon Core",
    body: "Lisans, abonelik, kota ve entitlement",
    href: "/#core",
    initials: "CO",
    badge: "Core",
  },
  {
    title: "Customer Portal",
    body: "Müşteri ürün, fatura ve destek paneli",
    href: "/login?next=%2Fdashboard",
    initials: "CP",
    badge: "Giriş",
  },
  {
    title: "PayTR",
    body: "Sanal POS — pilot doğrulama sonrası",
    href: "/demo-request",
    initials: "PT",
    badge: "Yakında",
  },
  {
    title: "WexHotel",
    body: "Otel yönetimi roadmap",
    href: "/products/wexhotel",
    initials: "WH",
    badge: "Roadmap",
  },
  {
    title: "WexB2B",
    body: "Bayi ve toptan satış roadmap",
    href: "/products/wexb2b",
    initials: "B2",
    badge: "Roadmap",
  },
] as const;

/** Pixels per second — keeps motion visible on phones even when CSS animations are disabled. */
const SPEED_PX_PER_SEC = 42;

export default function WexonHeroServiceMarquee() {
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    let last = performance.now();

    const finePointerHover = () =>
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const onEnter = () => {
      if (finePointerHover()) pausedRef.current = true;
    };
    const onLeave = () => {
      pausedRef.current = false;
    };

    track.addEventListener("pointerenter", onEnter);
    track.addEventListener("pointerleave", onLeave);

    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;

      if (!pausedRef.current && document.visibilityState === "visible") {
        const loopWidth = track.scrollWidth / 2;
        if (loopWidth > 0) {
          offsetRef.current += (SPEED_PX_PER_SEC * dt) / 1000;
          if (offsetRef.current >= loopWidth) {
            offsetRef.current -= loopWidth;
          }
          track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener("pointerenter", onEnter);
      track.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const rows = [...SERVICE_CARDS, ...SERVICE_CARDS];

  return (
    <div className="relative mt-10 w-full sm:mt-12 lg:mt-14">
      <div className="mb-5 flex items-center justify-center gap-3">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/15" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Platform katmanları
        </span>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-white/15" aria-hidden />
      </div>

      <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 overflow-hidden">
        {/* CSS mask-image freezes compositing on some iOS Safari builds — use solid fades. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#03150f] to-transparent sm:w-14"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#03150f] to-transparent sm:w-14"
          aria-hidden
        />

        <div
          ref={trackRef}
          className="wx-hero-marquee-track flex w-max gap-3 px-3 py-1 will-change-transform sm:gap-3 sm:px-4"
        >
          {rows.map((card, index) => (
            <Link
              key={`${card.title}-${index}`}
              href={resolveNavigationHref(card.href)}
              prefetch={false}
              className="wx-hero-marquee-card group relative flex w-[min(18rem,calc(100vw-2.5rem))] shrink-0 items-center gap-3 overflow-hidden rounded-[18px] border border-white/10 bg-[#0b2819] px-4 py-3.5 text-left shadow-[0_16px_40px_-20px_rgba(0,0,0,0.7)] transition duration-300 hover:-translate-y-1 hover:border-emerald-400/30 sm:w-[19rem]"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] to-transparent" />
              <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl transition-opacity duration-300 group-hover:bg-emerald-400/20" />

              <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-[11px] font-black text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
                {card.initials}
              </span>

              <div className="relative min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13px] font-bold tracking-tight text-white">{card.title}</p>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">
                    {card.badge}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400/90">{card.body}</p>
              </div>

              <span
                className="relative shrink-0 text-[13px] text-slate-500 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-emerald-300"
                aria-hidden
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

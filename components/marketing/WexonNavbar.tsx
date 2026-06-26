"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NAV_LINKS } from "@/lib/wexon-mock-data";
import { publicUrl, resolveNavigationHref } from "@/lib/wexon/urls";

function WexonMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10b981] shadow-sm shadow-emerald-500/30">
      <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
        <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="2" fill="white" />
      </svg>
    </div>
  );
}

interface WexonNavbarProps {
  transparent?: boolean;
}

export default function WexonNavbar({ transparent = false }: WexonNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    let frame = 0;
    let lastScrolled = window.scrollY > 16;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const nextScrolled = window.scrollY > 16;
        if (nextScrolled !== lastScrolled) {
          lastScrolled = nextScrolled;
          setScrolled(nextScrolled);
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const overDark = transparent && !scrolled;
  const lightMobileChrome = menuOpen;

  const headerSurfaceClass =
    scrolled || lightMobileChrome
      ? "bg-white/95 shadow-sm shadow-slate-200/40 backdrop-blur-xl"
      : transparent
        ? "bg-transparent"
        : "bg-white/60 backdrop-blur";

  const brandTextClass =
    overDark && !scrolled && !lightMobileChrome ? "text-white" : "text-slate-950";

  const mobileToggleClass =
    overDark && !lightMobileChrome
      ? "text-white hover:bg-white/10"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950";

  const navShellClass = overDark
    ? "border-white/12 bg-white/[0.1] shadow-[0_18px_60px_-28px_rgba(16,185,129,0.55)] backdrop-blur-xl hover:border-white/22 hover:bg-white/[0.14]"
    : "border-slate-200/80 bg-white/80 shadow-sm shadow-slate-200/30 hover:border-slate-200 hover:bg-white/90";

  const navLinkClass = overDark
    ? "text-white/90 hover:bg-white/12 hover:text-white"
    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950";

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${headerSurfaceClass}`}>
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-5 sm:px-8 md:grid md:h-20 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center lg:px-12 xl:px-16 2xl:px-20">
        <Link href={publicUrl("/")} className="flex h-11 min-w-0 shrink-0 items-center gap-2.5 md:justify-self-start">
          <WexonMark />
          <span className={`text-lg font-bold tracking-tight transition-colors ${brandTextClass}`}>
            Wexon
          </span>
        </Link>

        <nav
          className={`wx-nav-pill group/nav hidden self-center transition-all duration-300 md:col-start-2 md:row-start-1 md:inline-flex md:justify-self-center ${navShellClass}`}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={resolveNavigationHref(link.href)}
              className={`wx-nav-pill-link text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 md:text-sm ${navLinkClass}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden h-11 items-center gap-2 justify-self-end md:col-start-3 md:row-start-1 md:flex">
          <Link
            href={publicUrl("/login")}
            className={`wx-tactile inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 ${
              overDark
                ? "border border-white/25 bg-transparent text-white backdrop-blur hover:border-white/40 hover:bg-white/10"
                : "bg-white/70 text-slate-700 shadow-sm shadow-slate-200/30 hover:bg-white hover:text-slate-950"
            }`}
          >
            Giriş Yap
          </Link>
          <Link
            href={publicUrl("/signup")}
            className="wx-tactile inline-flex h-11 items-center justify-center rounded-full bg-[#10b981] px-5 text-sm font-bold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2"
          >
            Kayıt Ol
          </Link>
        </div>

        <button
          type="button"
          aria-label="Menüyü Aç/Kapat"
          aria-expanded={menuOpen}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors md:hidden ${mobileToggleClass}`}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 pb-5 shadow-lg shadow-slate-200/30 md:hidden">
          <div className="space-y-1 pb-3 pt-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={resolveNavigationHref(link.href)}
                onClick={() => setMenuOpen(false)}
                className="wx-tactile block rounded-full px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
            <Link
              href={publicUrl("/login")}
              onClick={() => setMenuOpen(false)}
              className="wx-tactile inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Giriş Yap
            </Link>
            <Link
              href={publicUrl("/signup")}
              onClick={() => setMenuOpen(false)}
              className="wx-tactile inline-flex w-full items-center justify-center rounded-full bg-[#10b981] px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500"
            >
              Kayıt Ol
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

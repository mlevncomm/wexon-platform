"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WexonBrandLogo from "@/components/marketing/WexonBrandLogo";
import { NAV_LINKS } from "@/lib/wexon-mock-data";
import { publicUrl, resolveNavigationHref } from "@/lib/wexon/urls";

function WexonBrand({ overDark }: { overDark: boolean }) {
  return (
    <WexonBrandLogo
      variant={overDark ? "hero" : "dark"}
      priority
      className="transition-opacity duration-300"
    />
  );
}

function PreApplicationTopBar({ overDark }: { overDark: boolean }) {
  return (
    <div
      className={`relative overflow-hidden border-b transition-colors duration-500 ${
        overDark
          ? "border-white/[0.04] bg-[linear-gradient(90deg,rgba(3,21,15,0.92)_0%,rgba(6,35,24,0.88)_50%,rgba(3,21,15,0.92)_100%)]"
          : "border-slate-200/60 bg-[linear-gradient(90deg,rgba(255,255,255,0.92)_0%,rgba(236,253,245,0.72)_50%,rgba(255,255,255,0.92)_100%)]"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto flex h-9 max-w-[1500px] items-center justify-center px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <p className="text-center text-[11px] font-medium leading-relaxed tracking-[0.01em] sm:text-xs">
          <span
            className={`mr-2 inline-flex h-1.5 w-1.5 translate-y-[-1px] rounded-full align-middle ${
              overDark ? "bg-emerald-400/75 shadow-[0_0_10px_rgba(52,211,153,0.45)]" : "bg-emerald-500/85"
            }`}
            aria-hidden
          />
          <span className={overDark ? "text-slate-500" : "text-slate-400"}>Ön başvuru dönemi</span>
          <span className={`mx-2.5 ${overDark ? "text-white/12" : "text-slate-300"}`} aria-hidden>
            |
          </span>
          <span className={overDark ? "text-slate-400" : "text-slate-500"}>Erişim planı için </span>
          <Link
            href={publicUrl("/on-basvuru")}
            className={`group inline-flex items-center gap-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
              overDark ? "text-emerald-100/95 hover:text-white" : "text-emerald-700 hover:text-emerald-800"
            }`}
          >
            <span className="underline decoration-emerald-400/25 underline-offset-[5px] transition-[text-decoration-color,color] group-hover:decoration-emerald-400/60">
              ön başvuru yapın
            </span>
            <span className="text-[10px] opacity-75 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>
              →
            </span>
          </Link>
        </p>
      </div>
    </div>
  );
}

function PreApplicationNavLink({
  overDark,
  className = "",
}: {
  overDark: boolean;
  className?: string;
}) {
  return (
    <Link
      href={publicUrl("/on-basvuru")}
      className={`group inline-flex h-11 items-center gap-1 px-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 ${
        overDark
          ? "text-emerald-100/85 hover:text-emerald-50"
          : "text-emerald-700/90 hover:text-emerald-800"
      } ${className}`}
    >
      <span className="underline decoration-emerald-400/25 underline-offset-[6px] transition-[text-decoration-color] group-hover:decoration-emerald-500/55">
        Ön başvuru
      </span>
      <span className="text-xs opacity-70 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>
        →
      </span>
    </Link>
  );
}

interface WexonNavbarProps {
  transparent?: boolean;
  /** Ana sayfada ince üst bar ile ön başvuru CTA gösterir. */
  preApplicationBar?: boolean;
}

export default function WexonNavbar({ transparent = false, preApplicationBar = false }: WexonNavbarProps) {
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
  const showInlinePreApplication = !preApplicationBar;

  const headerSurfaceClass =
    scrolled || lightMobileChrome
      ? "bg-white shadow-lg shadow-slate-200/25 backdrop-blur-xl"
      : transparent
        ? "bg-transparent"
        : "bg-white/60 backdrop-blur";

  const headerShapeClass = lightMobileChrome ? "rounded-b-[24px] md:rounded-none" : "";

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
    <header
      className={`fixed inset-x-0 top-0 z-50 overflow-hidden transition-all duration-300 ease-out ${headerSurfaceClass} ${headerShapeClass}`}
    >
      {preApplicationBar && <PreApplicationTopBar overDark={overDark && !lightMobileChrome} />}

      <div className="mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="flex h-16 items-center justify-between gap-3 md:grid md:h-20 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
          <Link href={publicUrl("/")} className="flex h-11 min-w-0 shrink-0 items-center md:justify-self-start">
            <WexonBrand overDark={overDark && !lightMobileChrome} />
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
            {showInlinePreApplication && <PreApplicationNavLink overDark={overDark} />}
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
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 md:hidden ${mobileToggleClass}`}
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

        <div
          className={`wx-mobile-nav-panel grid transition-[grid-template-rows,opacity] duration-300 ease-out md:hidden ${
            menuOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 px-1 pb-5 pt-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={resolveNavigationHref(link.href)}
                  onClick={() => setMenuOpen(false)}
                  tabIndex={menuOpen ? 0 : -1}
                  aria-hidden={!menuOpen}
                  className="wx-tactile block rounded-full px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
                {(preApplicationBar || showInlinePreApplication) && (
                  <Link
                    href={publicUrl("/on-basvuru")}
                    onClick={() => setMenuOpen(false)}
                    tabIndex={menuOpen ? 0 : -1}
                    aria-hidden={!menuOpen}
                    className="wx-tactile inline-flex w-full items-center justify-center gap-1 px-5 py-3 text-sm font-medium text-emerald-700 underline decoration-emerald-300/50 underline-offset-[6px] hover:text-emerald-800 hover:decoration-emerald-500/60"
                  >
                    Ön başvuru <span aria-hidden>→</span>
                  </Link>
                )}
                <Link
                  href={publicUrl("/login")}
                  onClick={() => setMenuOpen(false)}
                  tabIndex={menuOpen ? 0 : -1}
                  aria-hidden={!menuOpen}
                  className="wx-tactile inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Giriş Yap
                </Link>
                <Link
                  href={publicUrl("/signup")}
                  onClick={() => setMenuOpen(false)}
                  tabIndex={menuOpen ? 0 : -1}
                  aria-hidden={!menuOpen}
                  className="wx-tactile inline-flex w-full items-center justify-center rounded-full bg-[#10b981] px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                >
                  Kayıt Ol
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

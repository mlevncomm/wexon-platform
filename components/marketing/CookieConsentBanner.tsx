"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  defaultAcceptedConsent,
  defaultRejectedConsent,
  readCookieConsent,
  writeCookieConsent,
  type CookieConsentPreferences,
} from "@/lib/cookie-consent";

const SSR_SNAPSHOT = "__ssr__";

function subscribeConsent(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener("wexon:cookie-consent", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("wexon:cookie-consent", handler);
  };
}

function getConsentSnapshot() {
  return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) ?? "";
}

function getServerSnapshot() {
  return SSR_SNAPSHOT;
}

export default function CookieConsentBanner() {
  const stored = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getServerSnapshot);
  const [managing, setManaging] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const persist = useCallback((prefs: CookieConsentPreferences) => {
    writeCookieConsent(prefs);
    setManaging(false);
  }, []);

  // SSR / pre-hydration: null. Admin host/path suppression lives in CookieConsentGate.
  if (stored === SSR_SNAPSHOT || stored) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] p-0 sm:p-5 sm:pb-6">
      <div className="pointer-events-auto mx-auto w-full max-w-none rounded-t-[28px] border border-slate-200 border-b-0 bg-white/95 p-5 shadow-[0_-12px_40px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md sm:ml-auto sm:mr-0 sm:max-w-md sm:rounded-[28px] sm:border-b sm:shadow-2xl sm:shadow-slate-950/15">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          <p className="text-sm font-black tracking-tight text-slate-950">Çerez tercihleri</p>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          Zorunlu çerezler sitenin çalışması için her zaman aktiftir. Analitik ve pazarlama çerezleri yalnızca onayınızla
          kullanılır. Ayrıntılar için{" "}
          <Link href="/cerez-politikasi" className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
            Çerez Politikası
          </Link>
          .
        </p>

        {managing ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" checked disabled className="mt-1 accent-emerald-600" />
              <span>
                <span className="font-bold text-slate-950">Zorunlu</span>
                <span className="block text-slate-500">Oturum, güvenlik ve temel işlevler (her zaman açık)</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="mt-1 accent-emerald-600"
              />
              <span>
                <span className="font-bold text-slate-950">Analitik</span>
                <span className="block text-slate-500">Performans ve kullanım analizi</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="mt-1 accent-emerald-600"
              />
              <span>
                <span className="font-bold text-slate-950">Pazarlama</span>
                <span className="block text-slate-500">Kampanya ve hedefleme (izinle)</span>
              </span>
            </label>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  persist({
                    necessary: true,
                    analytics,
                    marketing,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                Tercihleri Kaydet
              </button>
              <button
                type="button"
                onClick={() => setManaging(false)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Geri
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => persist(defaultAcceptedConsent())}
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
            >
              Tümünü Kabul Et
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => persist(defaultRejectedConsent())}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Tümünü Reddet
              </button>
              <button
                type="button"
                onClick={() => {
                  const existing = readCookieConsent();
                  setAnalytics(existing?.analytics ?? false);
                  setMarketing(existing?.marketing ?? false);
                  setManaging(true);
                }}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Tercihlerimi Yönet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

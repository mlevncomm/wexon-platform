"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  disableAdminPreviewWriteAction,
  enableAdminPreviewWriteAction,
} from "@/lib/wexon-admin-preview-write-actions";

export type AdminWexPayPreviewBannerProps = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  isDemo: boolean;
  writeEnabled: boolean;
  expiresAt: number | null;
  redirectTo: string;
};

function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export default function AdminWexPayPreviewBanner({
  organizationId,
  organizationName,
  organizationSlug,
  isDemo,
  writeEnabled,
  expiresAt,
  redirectTo,
}: AdminWexPayPreviewBannerProps) {
  const [now, setNow] = useState(() => Date.now());
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const previewError = searchParams.get("previewError") ?? searchParams.get("wexpayError") ?? undefined;
  const effectiveRedirect = pathname || redirectTo;

  useEffect(() => {
    if (!writeEnabled || !expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [writeEnabled, expiresAt]);

  const remainingMs = writeEnabled && expiresAt ? Math.max(0, expiresAt - now) : null;
  const writeLive = Boolean(writeEnabled && remainingMs !== null && remainingMs > 0);

  return (
    <div
      data-testid="admin-wexpay-preview-banner"
      className="sticky top-0 z-50 border-b border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 text-amber-950 shadow-sm"
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">
              Admin preview
            </p>
            <p className="truncate text-sm font-black text-slate-950 sm:text-base">
              {organizationName}
              <span className="ml-2 font-mono text-xs font-bold text-slate-600">/{organizationSlug}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span
                className={`rounded-md px-2 py-0.5 ${
                  isDemo ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {isDemo ? "Demo" : "Real"}
              </span>
              <span
                data-testid="admin-preview-write-mode"
                className={`rounded-md px-2 py-0.5 ${
                  writeLive ? "bg-rose-100 text-rose-800" : "bg-slate-900 text-white"
                }`}
              >
                {writeLive
                  ? `Write-enabled · ${formatRemaining(remainingMs!)}`
                  : "Read-only"}
              </span>
            </div>
          </div>

          {writeLive ? (
            <form action={disableAdminPreviewWriteAction} className="shrink-0">
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="redirectTo" value={effectiveRedirect} />
              <button
                type="submit"
                data-testid="admin-preview-disable-write"
                className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-black text-rose-800 hover:bg-rose-50"
              >
                Yazmayı kapat
              </button>
            </form>
          ) : null}
        </div>

        {!writeLive ? (
          <p
            data-testid="admin-preview-readonly-notice"
            className="text-[11px] font-semibold text-slate-700"
          >
            Salt okunur önizleme — yazmak için doğrulama gerekli
          </p>
        ) : null}

        {previewError ? (
          <p
            data-testid="admin-preview-error"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
          >
            {previewError}
          </p>
        ) : null}

        {!writeLive && !isDemo ? (
          <form
            action={enableAdminPreviewWriteAction}
            className="grid gap-2 rounded-xl border border-amber-200 bg-white/80 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
            data-testid="admin-preview-enable-write-form"
          >
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="redirectTo" value={effectiveRedirect} />
            <label className="block text-[11px] font-bold text-slate-700">
              Organizasyon slug (tam eşleşme)
              <input
                name="organizationSlug"
                required
                autoComplete="off"
                data-testid="admin-preview-slug"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs font-semibold text-slate-900"
                placeholder={organizationSlug}
              />
            </label>
            <label className="block text-[11px] font-bold text-slate-700">
              Neden (≥ 8 karakter)
              <input
                name="reason"
                required
                minLength={8}
                data-testid="admin-preview-reason"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900"
                placeholder="Destek incelemesi / düzeltme notu"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                data-testid="admin-preview-enable-write"
                className="w-full rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-slate-800 sm:w-auto"
              >
                Yazmayı aç (10 dk)
              </button>
            </div>
          </form>
        ) : null}

        {isDemo ? (
          <p className="text-[11px] font-semibold text-slate-600">
            Demo tenant her zaman salt okunurdur. Yazma modu açılamaz.
          </p>
        ) : null}
      </div>
    </div>
  );
}

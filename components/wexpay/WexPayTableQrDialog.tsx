"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildTableQrPrintHtml,
  copyTextToClipboard,
  downloadTableQrPng,
  downloadTableQrSvg,
  generateTableQrDataUrl,
} from "@/lib/wexpay-table-qr";

export type WexPayTableQrDialogProps = {
  open: boolean;
  onClose: () => void;
  tableLabel: string;
  branchName?: string;
  publicQrUrl: string;
};

export default function WexPayTableQrDialog({
  open,
  onClose,
  tableLabel,
  branchName,
  publicQrUrl,
}: WexPayTableQrDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const revokeFns = useRef<Array<() => void>>([]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "error">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
      for (const revoke of revokeFns.current) revoke();
      revokeFns.current = [];
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      try {
        const dataUrl = await generateTableQrDataUrl(publicQrUrl);
        if (cancelled) return;
        setPreviewUrl(dataUrl);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setActionError("QR kodu oluşturulamadı.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, publicQrUrl]);

  async function handleCopy() {
    setActionError(null);
    try {
      await copyTextToClipboard(publicQrUrl);
      setCopyState("ok");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      setActionError("Link kopyalanamadı. Bağlantıyı elle seçip kopyalayın.");
    }
  }

  async function handlePng() {
    setBusyAction("png");
    setActionError(null);
    try {
      const revoke = await downloadTableQrPng(publicQrUrl, tableLabel);
      revokeFns.current.push(revoke);
      window.setTimeout(revoke, 30_000);
    } catch {
      setActionError("PNG indirilemedi.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSvg() {
    setBusyAction("svg");
    setActionError(null);
    try {
      const revoke = await downloadTableQrSvg(publicQrUrl, tableLabel);
      revokeFns.current.push(revoke);
      window.setTimeout(revoke, 30_000);
    } catch {
      setActionError("SVG indirilemedi.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePrint() {
    setBusyAction("print");
    setActionError(null);
    try {
      const qrDataUrl = previewUrl ?? (await generateTableQrDataUrl(publicQrUrl, 640));
      const html = buildTableQrPrintHtml({
        tableLabel,
        publicUrl: publicQrUrl,
        qrDataUrl,
      });
      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=480,height=720");
      if (!printWindow) {
        setActionError("Yazdırma penceresi açılamadı.");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => {
        try {
          printWindow.close();
        } catch {
          /* ignore */
        }
      }, 500);
    } catch {
      setActionError("Yazdırma hazırlanamadı.");
    } finally {
      setBusyAction(null);
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="presentation" data-testid="table-qr-dialog-root">
      <button type="button" className="absolute inset-0 bg-slate-950/45" aria-label="QR penceresini kapat" onClick={close} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="table-qr-dialog"
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(92dvh,40rem)] sm:w-[min(92vw,28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-black text-slate-950">
              {tableLabel} QR kodu
            </h2>
            {branchName ? <p className="mt-1 truncate text-sm font-semibold text-slate-500">{branchName}</p> : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Kapat"
            data-testid="table-qr-dialog-close"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
          <div className="mx-auto flex h-[280px] w-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-3">
            {loading || !previewUrl ? (
              <div
                className="h-full w-full animate-pulse rounded-xl bg-slate-100"
                data-testid="table-qr-skeleton"
                aria-busy="true"
                aria-label="QR yükleniyor"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={`${tableLabel} müşteri QR kodu`} className="h-full w-full" width={280} height={280} />
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Müşteri linki</span>
            <input
              readOnly
              value={publicQrUrl}
              data-testid="table-qr-url"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs font-semibold text-slate-800"
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>

          {copyState === "ok" ? (
            <p className="text-sm font-bold text-emerald-700" data-testid="table-qr-copy-success" role="status">
              Link kopyalandı
            </p>
          ) : null}
          {actionError ? (
            <p className="text-sm font-bold text-rose-700" role="alert">
              {actionError}
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleCopy}
              data-testid="table-qr-copy"
              className="min-h-11 rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
            >
              {copyState === "ok" ? "Kopyalandı" : "Linki kopyala"}
            </button>
            <a
              href={publicQrUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="table-qr-open"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-900 hover:border-emerald-300 hover:bg-emerald-50"
            >
              Müşteri sayfasını aç
            </a>
            <button
              type="button"
              onClick={handlePng}
              disabled={busyAction !== null}
              data-testid="table-qr-download-png"
              className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-900 hover:bg-slate-50 disabled:opacity-50"
            >
              {busyAction === "png" ? "İndiriliyor…" : "PNG indir"}
            </button>
            <button
              type="button"
              onClick={handleSvg}
              disabled={busyAction !== null}
              data-testid="table-qr-download-svg"
              className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-900 hover:bg-slate-50 disabled:opacity-50"
            >
              {busyAction === "svg" ? "İndiriliyor…" : "SVG indir"}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={busyAction !== null}
              data-testid="table-qr-print"
              className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-900 hover:bg-slate-50 disabled:opacity-50 sm:col-span-2"
            >
              {busyAction === "print" ? "Hazırlanıyor…" : "Yazdır"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

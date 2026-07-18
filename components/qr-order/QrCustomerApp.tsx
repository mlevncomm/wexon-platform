"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import QrBillScreen from "@/components/qr-order/QrBillScreen";
import QrCartSheet from "@/components/qr-order/QrCartSheet";
import QrCheckoutSuccess from "@/components/qr-order/QrCheckoutSuccess";
import QrLanding from "@/components/qr-order/QrLanding";
import QrMenuScreen from "@/components/qr-order/QrMenuScreen";
import QrOrderStatusScreen from "@/components/qr-order/QrOrderStatusScreen";
import QrWaiterCall from "@/components/qr-order/QrWaiterCall";
import {
  clearCartStorage,
  readCartFromStorage,
  setCartLineQuantity,
  upsertCartLine,
  writeCartToStorage,
} from "@/lib/qr-order/cart";
import { buildOrderNote } from "@/lib/qr-order/pricing";
import type {
  QrCartLine,
  QrCategory,
  QrOrderSuccess,
  QrPaytrReturn,
  QrTableContext,
  QrView,
} from "@/lib/qr-order/types";

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `qr-order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function QrCustomerApp({
  context,
  categories,
  initialPaytrReturn = null,
}: {
  context: QrTableContext;
  categories: QrCategory[];
  initialPaytrReturn?: QrPaytrReturn | null;
}) {
  const [view, setView] = useState<QrView>(initialPaytrReturn ? "bill" : "landing");
  const [lines, setLines] = useState<QrCartLine[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [generalNote, setGeneralNote] = useState("");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderPending, setOrderPending] = useState(false);
  const [success, setSuccess] = useState<QrOrderSuccess | null>(null);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [paytrReturn] = useState<QrPaytrReturn | null>(initialPaytrReturn);
  const submitLock = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [, startCartTransition] = useTransition();

  useEffect(() => {
    const stored = readCartFromStorage(context.qrCode);
    startCartTransition(() => {
      setLines(stored);
      setCartReady(true);
    });
  }, [context.qrCode, startCartTransition]);

  useEffect(() => {
    if (!cartReady) return;
    writeCartToStorage(context.qrCode, lines);
  }, [context.qrCode, lines, cartReady]);

  useEffect(() => {
    if (!paytrReturn) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("paytr") && !url.searchParams.has("paymentId")) return;
    url.searchParams.delete("paytr");
    url.searchParams.delete("paymentId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [paytrReturn]);

  const menuEmpty = categories.every((category) => category.products.length === 0);

  function addLine(line: QrCartLine) {
    setLines((current) => {
      const existing = current.find((item) => item.key === line.key);
      if (existing) {
        return upsertCartLine(current, {
          ...existing,
          quantity: existing.quantity + line.quantity,
        });
      }
      return upsertCartLine(current, line);
    });
  }

  async function submitOrder() {
    if (submitLock.current || orderPending) return;
    if (lines.length === 0) {
      setOrderError("Sipariş göndermek için sepete ürün ekleyin.");
      return;
    }

    submitLock.current = true;
    setOrderPending(true);
    setOrderError(null);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = newIdempotencyKey();
    }

    try {
      const note = buildOrderNote(lines, generalNote);
      const response = await fetch(
        `/api/wexpay/public/${encodeURIComponent(context.qrCode)}/order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKeyRef.current,
          },
          body: JSON.stringify({
            note,
            items: lines.map((line) => ({
              productId: line.product.id,
              quantity: line.quantity,
              ...(line.modifierOptionIds?.length
                ? { modifierOptionIds: line.modifierOptionIds }
                : {}),
            })),
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        orderNo?: string;
        subtotal?: number;
        status?: string;
      };

      if (!response.ok) {
        const message = payload.error ?? "Sipariş gönderilemedi. Lütfen tekrar deneyin.";
        setOrderError(message);
        if (/stok|fiyat|bulunamad|aktif değil/i.test(message)) {
          setOrderError(
            `${message} Menüdeki güncel fiyat ve stok için ürünleri kontrol edip tekrar deneyin.`,
          );
        }
        return;
      }

      setSuccess({
        orderId: payload.id ?? "",
        orderNo: payload.orderNo ?? "-",
        subtotal: Number(payload.subtotal ?? 0),
        status: payload.status ?? "NEW",
      });
      setLines([]);
      setGeneralNote("");
      clearCartStorage(context.qrCode);
      idempotencyKeyRef.current = null;
      setView("success");
    } catch {
      setOrderError("Bağlantı hatası. Lütfen tekrar deneyin. Sepetiniz korundu.");
    } finally {
      setOrderPending(false);
      submitLock.current = false;
    }
  }

  return (
    <main className="relative isolate w-full min-h-[100dvh] flex-1 text-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(165deg,#F6F8F5_0%,#ECFDF5_38%,#FAFAF7_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-24 top-0 -z-10 h-[28rem] w-[28rem] rounded-full bg-emerald-200/45 blur-3xl motion-reduce:hidden sm:h-[36rem] sm:w-[36rem]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-20 top-32 -z-10 h-[24rem] w-[24rem] rounded-full bg-lime-200/40 blur-3xl motion-reduce:hidden sm:top-16 sm:h-[32rem] sm:w-[32rem]"
      />

      <div aria-live="polite" className="sr-only">
        {orderPending ? "Sipariş gönderiliyor" : null}
        {success && view === "success" ? `Sipariş alındı ${success.orderNo}` : null}
      </div>

      {view === "landing" ? (
        <QrLanding
          context={context}
          menuEmpty={menuEmpty}
          onBrowseMenu={() => setView("menu")}
          onPay={() => setView("bill")}
          onCallWaiter={() => setWaiterOpen(true)}
        />
      ) : null}

      {view === "menu" ? (
        <QrMenuScreen
          context={context}
          categories={categories}
          lines={lines}
          onAddLine={addLine}
          onOpenCart={() => setView("cart")}
          onBack={() => setView("landing")}
          onCallWaiter={() => setWaiterOpen(true)}
        />
      ) : null}

      {view === "cart" ? (
        <QrCartSheet
          context={context}
          lines={lines}
          generalNote={generalNote}
          error={orderError}
          pending={orderPending}
          onGeneralNoteChange={setGeneralNote}
          onQuantityChange={(key, quantity) =>
            setLines((current) => setCartLineQuantity(current, key, quantity))
          }
          onRemove={(key) => setLines((current) => setCartLineQuantity(current, key, 0))}
          onBack={() => setView("menu")}
          onSubmit={() => void submitOrder()}
        />
      ) : null}

      {view === "success" && success ? (
        <QrCheckoutSuccess
          context={context}
          order={success}
          onTrack={() => setView("status")}
          onNewOrder={() => {
            setSuccess(null);
            setView("menu");
          }}
          onCallWaiter={() => setWaiterOpen(true)}
        />
      ) : null}

      {view === "status" ? (
        <QrOrderStatusScreen
          context={context}
          highlightOrderNo={success?.orderNo ?? null}
          onBack={() => setView(success ? "success" : "landing")}
          onNewOrder={() => {
            setSuccess(null);
            setView("menu");
          }}
          onViewBill={() => setView("bill")}
        />
      ) : null}

      {view === "bill" ? (
        <QrBillScreen
          context={context}
          paytrReturn={paytrReturn}
          onBack={() => setView("landing")}
          onCallWaiter={() => setWaiterOpen(true)}
          onTrackOrders={() => setView("status")}
        />
      ) : null}

      <QrWaiterCall
        qrCode={context.qrCode}
        open={waiterOpen}
        onClose={() => setWaiterOpen(false)}
      />
    </main>
  );
}

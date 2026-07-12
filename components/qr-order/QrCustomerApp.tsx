"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import QrBillScreen from "@/components/qr-order/QrBillScreen";
import QrCartSheet from "@/components/qr-order/QrCartSheet";
import QrCheckoutSuccess from "@/components/qr-order/QrCheckoutSuccess";
import QrLanding from "@/components/qr-order/QrLanding";
import QrMenuScreen from "@/components/qr-order/QrMenuScreen";
import QrWaiterCall from "@/components/qr-order/QrWaiterCall";
import {
  clearCartStorage,
  readCartFromStorage,
  setCartLineQuantity,
  upsertCartLine,
  writeCartToStorage,
} from "@/lib/qr-order/cart";
import { getMockOptionGroups } from "@/lib/qr-order/mock-options";
import { buildOrderNote } from "@/lib/qr-order/pricing";
import type {
  QrCartLine,
  QrCategory,
  QrOrderSuccess,
  QrTableContext,
  QrView,
} from "@/lib/qr-order/types";

export default function QrCustomerApp({
  context,
  categories,
}: {
  context: QrTableContext;
  categories: QrCategory[];
}) {
  const [view, setView] = useState<QrView>("landing");
  const [lines, setLines] = useState<QrCartLine[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [generalNote, setGeneralNote] = useState("");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderPending, setOrderPending] = useState(false);
  const [success, setSuccess] = useState<QrOrderSuccess | null>(null);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const submitLock = useRef(false);
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

  const groupsByProductId = (() => {
    const map: Record<string, ReturnType<typeof getMockOptionGroups>> = {};
    for (const category of categories) {
      for (const product of category.products) {
        map[product.id] = getMockOptionGroups(product.name);
      }
    }
    return map;
  })();

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

    try {
      const note = buildOrderNote(lines, groupsByProductId, generalNote);
      const response = await fetch(
        `/api/wexpay/public/${encodeURIComponent(context.qrCode)}/order`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note,
            items: lines.map((line) => ({
              productId: line.product.id,
              quantity: line.quantity,
            })),
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        orderNo?: string;
        subtotal?: number;
      };

      if (!response.ok) {
        setOrderError(payload.error ?? "Sipariş gönderilemedi. Lütfen tekrar deneyin.");
        return;
      }

      setSuccess({
        orderId: payload.id ?? "",
        orderNo: payload.orderNo ?? "-",
        subtotal: Number(payload.subtotal ?? 0),
      });
      setLines([]);
      setGeneralNote("");
      clearCartStorage(context.qrCode);
      setView("success");
    } catch {
      setOrderError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setOrderPending(false);
      submitLock.current = false;
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[linear-gradient(165deg,#F6F8F5_0%,#ECFDF5_42%,#FAFAF7_100%)] text-slate-950">
      {view === "landing" ? (
        <QrLanding
          context={context}
          menuEmpty={menuEmpty}
          onOrder={() => setView("menu")}
          onPay={() => setView("bill")}
          onBrowseMenu={() => setView("menu")}
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
          groupsByProductId={groupsByProductId}
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
          onBackHome={() => {
            setSuccess(null);
            setView("menu");
          }}
          onViewBill={() => {
            setSuccess(null);
            setView("bill");
          }}
          onCallWaiter={() => setWaiterOpen(true)}
        />
      ) : null}

      {view === "bill" ? (
        <QrBillScreen
          context={context}
          onBack={() => setView("landing")}
          onCallWaiter={() => setWaiterOpen(true)}
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

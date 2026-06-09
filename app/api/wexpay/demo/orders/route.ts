import { NotificationType, TableStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../_access";
import { errorResponse, toOrderResponse } from "../_utils";

type CreateOrderBody = {
  tableName?: unknown;
  note?: unknown;
  receiptRequested?: unknown;
  items?: unknown;
};

type OrderItemInput = {
  productId: string;
  quantity: number;
};

function isOrderItemInput(item: unknown): item is OrderItemInput {
  if (!item || typeof item !== "object") return false;

  const candidate = item as { productId?: unknown; quantity?: unknown };
  return (
    typeof candidate.productId === "string" &&
    candidate.productId.trim().length > 0 &&
    typeof candidate.quantity === "number" &&
    Number.isInteger(candidate.quantity) &&
    candidate.quantity > 0
  );
}

function createOrderNumber() {
  return `WX-${Date.now().toString().slice(-8)}`;
}

export async function GET() {
  try {
    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const orders = await prisma.customerOrder.findMany({
      where: { branchId: demo.branch.id },
      include: {
        table: true,
        items: {
          orderBy: { id: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ orders: orders.map(toOrderResponse) });
  } catch {
    return errorResponse("Sipariş işlemi sırasında bir sorun oluştu.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateOrderBody;
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0 || !items.every(isOrderItemInput)) {
      return errorResponse("Sipariş için geçerli ürünler zorunludur.", 400);
    }

    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const tableName = typeof body.tableName === "string" && body.tableName.trim() ? body.tableName.trim() : "Masa 12";
    const table = await prisma.restaurantTable.findFirst({
      where: {
        branchId: demo.branch.id,
        label: tableName,
        isActive: true,
      },
    });

    if (!table) return errorResponse("Masa bulunamadı.", 404);

    const productIds = [...new Set(items.map((item) => item.productId.trim()))];
    const products = await prisma.menuProduct.findMany({
      where: {
        branchId: demo.branch.id,
        id: { in: productIds },
      },
    });

    if (products.length !== productIds.length) return errorResponse("Ürün bulunamadı.", 404);

    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderItems = items.map((item) => {
      const product = productMap.get(item.productId.trim());
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      if (!product.isActive) throw new Error("PRODUCT_INACTIVE");
      if (!product.inStock) throw new Error("PRODUCT_OUT_OF_STOCK");

      const price = Number(product.price);
      const lineTotal = price * item.quantity;

      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: price,
        totalPrice: lineTotal,
      };
    });

    const totalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    const receiptRequested = typeof body.receiptRequested === "boolean" ? body.receiptRequested : false;

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.customerOrder.create({
        data: {
          orderNo: createOrderNumber(),
          branchId: demo.branch.id,
          tableId: table.id,
          status: "NEW",
          note,
          receiptRequested,
          subtotal: totalAmount,
          items: {
            create: orderItems,
          },
        },
        include: {
          table: true,
          items: {
            orderBy: { id: "asc" },
          },
        },
      });

      await tx.restaurantTable.update({
        where: { id: table.id },
        data: { status: TableStatus.OCCUPIED },
      });

      await tx.businessNotification.create({
        data: {
          branchId: demo.branch.id,
          orderId: createdOrder.id,
          type: NotificationType.ORDER_CREATED,
          title: "Yeni sipariş alındı",
          message: `${table.label} için yeni sipariş oluşturuldu.`,
        },
      });

      await writeWexPayDemoAudit(
        {
          request,
          organizationId: demo.organizationId,
          action: "wexpay.demo.order.created",
          entityType: "CustomerOrder",
          entityId: createdOrder.id,
          metadata: {
            branchId: demo.branch.id,
            tableId: table.id,
            orderNo: createdOrder.orderNo,
            itemCount: orderItems.length,
            subtotal: totalAmount,
          },
        },
        tx,
      );

      return createdOrder;
    });

    return Response.json(toOrderResponse(order));
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_INACTIVE") {
      return errorResponse("Pasif ürünler siparişe eklenemez.", 400);
    }

    if (error instanceof Error && error.message === "PRODUCT_OUT_OF_STOCK") {
      return errorResponse("Stokta olmayan ürünler siparişe eklenemez.", 400);
    }

    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return errorResponse("Ürün bulunamadı.", 404);
    }

    return errorResponse("Sipariş işlemi sırasında bir sorun oluştu.", 500);
  }
}

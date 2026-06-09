import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext } from "../_access";
import { errorResponse } from "../_utils";

export async function GET() {
  try {
    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const notifications = await prisma.businessNotification.findMany({
      where: {
        branchId: demo.branch.id,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return Response.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
      })),
    });
  } catch {
    return errorResponse("Bildirimler yüklenirken bir sorun oluştu.", 500);
  }
}

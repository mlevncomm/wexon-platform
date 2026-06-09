import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext } from "../_access";
import { errorResponse, toTableResponse } from "../_utils";

function getNaturalTableNumber(label: string) {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

export async function GET() {
  try {
    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const tables = await prisma.restaurantTable.findMany({
      where: {
        branchId: demo.branch.id,
        isActive: true,
      },
      include: {
        orders: {
          where: {
            status: {
              not: "CANCELLED",
            },
          },
          include: {
            items: {
              orderBy: { id: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        receiptRequests: {
          where: {
            status: "REQUESTED",
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const sortedTables = [...tables].sort((first, second) => {
      const firstNumber = getNaturalTableNumber(first.label);
      const secondNumber = getNaturalTableNumber(second.label);

      if (firstNumber !== secondNumber) return firstNumber - secondNumber;
      return first.label.localeCompare(second.label, "tr");
    });

    return Response.json({ tables: sortedTables.map(toTableResponse) });
  } catch {
    return errorResponse("Masa verileri yüklenirken bir sorun oluştu.", 500);
  }
}

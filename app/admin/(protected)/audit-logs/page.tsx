import WexonAdminAuditLogsPanel from "@/components/marketing/WexonAdminAuditLogsPanel";
import type { AdminAuditLogFilters } from "@/lib/wexon-admin";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Number(readParam(params.page) ?? "1");

  const filters: AdminAuditLogFilters = {
    organizationId: readParam(params.organizationId),
    level: readParam(params.level),
    status: readParam(params.status),
    q: readParam(params.q),
    page: Number.isFinite(page) ? page : 1,
  };

  return <WexonAdminAuditLogsPanel filters={filters} />;
}

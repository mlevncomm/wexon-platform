import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";
import { wexpayAdminPreviewBasePath } from "@/lib/wexon-admin-preview-path";

export async function resolveAdminPreviewPanelContext(organizationId: string) {
  const context = await resolveWexPaySessionContext({ organizationId });
  const basePath = wexpayAdminPreviewBasePath(organizationId);
  return { context, basePath };
}

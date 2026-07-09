import type { ReactNode } from "react";
import WexonAdminShell from "@/components/marketing/WexonAdminShell";
import { assertAdminAccess } from "@/lib/wexon-admin-auth";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  await assertAdminAccess();
  return <WexonAdminShell>{children}</WexonAdminShell>;
}

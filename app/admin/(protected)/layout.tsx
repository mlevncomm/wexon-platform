import type { ReactNode } from "react";
import WexonAdminShell from "@/components/marketing/WexonAdminShell";

export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  return <WexonAdminShell>{children}</WexonAdminShell>;
}

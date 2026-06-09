import type { ReactNode } from "react";
import WexonDashboardShell from "@/components/marketing/WexonDashboardShell";

export default function DashboardPanelLayout({ children }: { children: ReactNode }) {
  return <WexonDashboardShell>{children}</WexonDashboardShell>;
}

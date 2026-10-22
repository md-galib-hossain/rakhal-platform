import { AdminShell } from "@/components/layout/admin-shell";

// TODO(P2-07): resolve the real admin session + permissions from the BFF cookie.
const PLACEHOLDER_PERMISSIONS: readonly string[] = ["*"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell permissions={PLACEHOLDER_PERMISSIONS}>{children}</AdminShell>;
}

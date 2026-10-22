import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { getSession } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // A temporary password blocks every admin API route until it is changed.
  if (session.mustChangePassword) redirect("/change-password");

  return (
    <AdminShell permissions={session.permissions} email={session.email} role={session.role}>
      {children}
    </AdminShell>
  );
}

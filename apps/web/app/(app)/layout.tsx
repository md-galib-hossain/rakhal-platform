import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Mirror of app/(onboarding)/onboarding/layout.tsx's own check: a session with
  // no real farm yet (bootstrap-scoped, or "" once optional-farmId login lands)
  // must never render the dashboard shell — every farm-scoped call in it 403/404s
  // behind FarmContextGuard. Send them to finish onboarding instead.
  if (!session.farmId || session.farmId === "bootstrap") redirect("/onboarding");
  return <AppShell>{children}</AppShell>;
}

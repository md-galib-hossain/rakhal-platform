import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/** Gate only — each page owns its own <AuthShell> chrome (title/description differ per page). */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return children;
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/**
 * Gate only, mirrors `app/(auth)/layout.tsx` — this route needs the "bootstrap"-scoped session
 * `loginWithBackend`'s "no-farms" branch persists (see `lib/auth/session.ts`), NOT a real
 * farm-scoped one, so it can't share `app/(app)/layout.tsx` (that shell's sidebar/topbar assume
 * real farm-scoped data). Once the user has a real farm there's nothing left to onboard.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.farmId !== "bootstrap") redirect("/dashboard");
  return children;
}

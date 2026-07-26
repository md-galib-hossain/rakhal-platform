import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import type { ApiEnvelope } from "@/types/api";
import type { OnboardingStatus } from "@/features/onboarding/types";

/**
 * Gate only, mirrors `app/(auth)/layout.tsx` — this route needs either the "bootstrap"-scoped
 * session `loginWithBackend`'s "no-farms" branch persists (Step 1, `CreateFarmForm`), or a real
 * farm-scoped one that hasn't finished the wizard yet (Steps 2–4, `OnboardingWizard`) — neither
 * can share `app/(app)/layout.tsx` (that shell's sidebar/topbar assume real farm-scoped data +
 * a completed farm). Once `hasCompletedOnboarding` is true there's nothing left to onboard.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // "" is the optional-farmId login's no-farm-yet state (I2); "bootstrap" is the older explicit
  // placeholder some callers still send — both mean "no real farm, render CreateFarmForm below".
  if (!session.farmId || session.farmId === "bootstrap") return children;

  // Real farm-scoped session — only let the wizard render if it isn't done yet.
  let res: Response;
  try {
    res = await fetch(`${serverEnv.API_BASE_URL}/onboarding/status`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    redirect("/dashboard"); // backend unreachable — don't strand the user on a broken wizard
  }
  const envelope = (await res.json()) as ApiEnvelope<OnboardingStatus>;
  if (envelope.success && envelope.data.has_completed_onboarding) redirect("/dashboard");
  return children;
}

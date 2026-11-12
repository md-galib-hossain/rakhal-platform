import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { CreateFarmForm } from "@/features/onboarding/components/create-farm-form";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import { getSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.createFarm");
  return { title: `${t("title")} — Rakhal`, description: t("subtitle") };
}

/** Step 1 (no farm yet — `farmId` is `""` from the optional-farmId login, or the older explicit
 * `"bootstrap"` placeholder) renders `CreateFarmForm`; the layout's own gate has already confirmed
 * a real farm-scoped session here means Steps 2–4 are still incomplete, so any other farmId
 * renders the wizard. */
export default async function OnboardingPage() {
  const session = await getSession();
  if (!session?.farmId || session.farmId === "bootstrap") {
    return (
      <AuthShell>
        <CreateFarmForm />
      </AuthShell>
    );
  }
  return <OnboardingWizard />;
}

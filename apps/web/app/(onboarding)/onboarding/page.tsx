import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { CreateFarmForm } from "@/features/onboarding/components/create-farm-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.createFarm");
  return { title: `${t("title")} — Rakhal`, description: t("subtitle") };
}

export default function OnboardingPage() {
  return (
    <AuthShell>
      <CreateFarmForm />
    </AuthShell>
  );
}

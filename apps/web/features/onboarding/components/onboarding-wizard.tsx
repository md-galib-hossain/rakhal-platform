"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingShell } from "./onboarding-shell";
import { WizardProgress, type WizardStep } from "./wizard-progress";
import { ConfigureStep } from "./configure-step";
import { CattleStep } from "./cattle-step";
import { TeamStep } from "./team-step";
import { useOnboardingStatus } from "../hooks/use-onboarding-status";
import { useCompleteOnboarding } from "../hooks/use-complete-onboarding";

const ORDER: WizardStep[] = ["configure", "cattle", "team"];

/** Steps 2–4 of the onboarding wizard (PRD §5.1), shown once the user has a real farm-scoped
 * session (`OnboardingLayout` redirects here only when `hasCompletedOnboarding` is still false —
 * see `app/(onboarding)/onboarding/layout.tsx`). Always restarts at Step 2 on load rather than
 * resuming mid-step — each step is independently skippable/re-runnable (configure/invite can be
 * repeated from Settings later, RFE-045), so exact resume position isn't worth the complexity for
 * an MVP wizard a user only ever sees once. */
export function OnboardingWizard() {
  const t = useTranslations("onboarding.wizard");
  const router = useRouter();
  const { isLoading } = useOnboardingStatus();
  const completeOnboarding = useCompleteOnboarding();
  const [stepIndex, setStepIndex] = useState(0);
  const step = ORDER[stepIndex];

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, ORDER.length - 1));
  }

  async function finish() {
    try {
      await completeOnboarding.mutateAsync();
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  if (isLoading) {
    return (
      <OnboardingShell>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <WizardProgress current={step} />

        {step === "configure" ? <ConfigureStep onNext={goNext} onSkip={goNext} /> : null}
        {step === "cattle" ? <CattleStep onNext={goNext} onSkip={goNext} /> : null}
        {step === "team" ? <TeamStep onFinish={finish} isFinishing={completeOnboarding.isPending} /> : null}
      </div>
    </OnboardingShell>
  );
}

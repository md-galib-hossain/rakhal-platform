"use client";

import { useTranslations } from "next-intl";
import { Progress } from "@rakhal/ui/ui/progress";

const STEPS = ["configure", "cattle", "team"] as const;
export type WizardStep = (typeof STEPS)[number];

export function WizardProgress({ current }: { current: WizardStep }) {
  const t = useTranslations("onboarding.wizard.steps");
  const index = STEPS.indexOf(current);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-foreground">{t(current)}</span>
        <span className="text-muted-foreground">{t("counter", { current: index + 1, total: STEPS.length })}</span>
      </div>
      <Progress value={((index + 1) / STEPS.length) * 100} />
    </div>
  );
}

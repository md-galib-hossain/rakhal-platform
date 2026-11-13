"use client"; // translated labels; the apply button is a click target

import { useTranslations } from "next-intl";
import { ShieldPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Chip } from "@/components/ui/chip";
import { diagnosisChipVariant } from "../format";
import { dayOfIllness, nextStepStatus } from "../sick-bay-model";
import type { HealthCaseListItem, HealthPriority } from "../types";
import { AppliedProtocolChip } from "./applied-protocol-chip";
import { ProgressRing } from "./progress-ring";

/** The cells of a Sick Bay row (RFE-134, EPIC_HEALTH_CENTER D11), shared by the desktop table and the phone cards so
 * both say the same thing the same way. Each cell is a plain piece of a case; layout is the caller's job. */

const PRIORITY_VARIANT: Record<HealthPriority, "muted" | "info" | "warning" | "destructive"> = {
  LOW: "muted",
  MEDIUM: "info",
  HIGH: "warning",
  CRITICAL: "destructive",
};

export function ConditionCell({ item }: { item: HealthCaseListItem }) {
  const t = useTranslations("health.sickBay");
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <Chip variant={diagnosisChipVariant(item.condition ?? item.note)} className="min-w-0 max-w-full">
        <TruncatedText>{item.condition ? t(`conditionValue.${item.condition}`) : (item.note ?? "—")}</TruncatedText>
      </Chip>
      {item.condition && item.note ? (
        <TruncatedText className="max-w-[220px] text-xs text-muted-foreground">{item.note}</TruncatedText>
      ) : null}
    </div>
  );
}

/** The applied protocol with its progress — or, for a case with none, the one-tap way to start one (an open loop,
 * not a dash). */
export function ProtocolCell({ item, onApply }: { item: HealthCaseListItem; onApply: (item: HealthCaseListItem) => void }) {
  const t = useTranslations("health.sickBay");
  if (item.healthPlan) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <AppliedProtocolChip name={item.healthPlan.name} current={item.currentStep} total={item.totalSteps} />
        {item.totalSteps > 0 ? <ProgressRing value={item.progressPercentage} /> : null}
      </div>
    );
  }
  return (
    <Can I="healthcare.update" fallback={<span className="text-sm text-muted-foreground">—</span>}>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => onApply(item)}>
        <ShieldPlus className="size-4" aria-hidden />
        {t("applyProtocol")}
      </Button>
    </Can>
  );
}

/** Next pending step, worded like the reminder notifications ("Today", "In 3 days", "2 days overdue") and red when it
 * is late. */
export function NextStepCell({ item }: { item: HealthCaseListItem }) {
  const t = useTranslations("health.taskHub.card");
  const next = item.tasks[0];
  if (!next) return <span className="text-sm text-muted-foreground">—</span>;
  const { days, tone } = nextStepStatus(next.dueDateTime);
  const label = days === 0 ? t("dueToday") : days === 1 ? t("dueTomorrow") : days > 1 ? t("dueInDays", { days }) : days === -1 ? t("dueYesterday") : t("overdueDays", { days: -days });
  return (
    <div className="flex min-w-0 flex-col">
      <span className={cn("text-sm", tone === "overdue" ? "font-medium text-destructive" : "text-foreground")}>{label}</span>
      <TruncatedText className="text-xs text-muted-foreground">{next.title}</TruncatedText>
    </div>
  );
}

/** Days until the animal's milk / meat are clear. `daysLeft` is `undefined` when the case has no dated withdrawal; if
 * the row still says it is withholding, show that rather than nothing. */
export function WithdrawalCell({ item, daysLeft }: { item: HealthCaseListItem; daysLeft: number | undefined }) {
  const t = useTranslations("health.sickBay");
  if (daysLeft != null) {
    return (
      <Chip variant="warning" subtle>
        {t("withdrawalLeft", { days: daysLeft })}
      </Chip>
    );
  }
  if (item.isSafetyWithholdingActive) {
    return (
      <Chip variant="warning" subtle>
        {t("withholding")}
      </Chip>
    );
  }
  return <span className="text-sm text-muted-foreground">—</span>;
}

export function PriorityChip({ priority }: { priority: HealthPriority }) {
  const t = useTranslations("health.reportSickness.priorityValue");
  return <Chip variant={PRIORITY_VARIANT[priority]}>{t(priority)}</Chip>;
}

export function DayCell({ startDate }: { startDate: string }) {
  const t = useTranslations("health.sickBay");
  return <span className="whitespace-nowrap text-sm text-foreground">{t("dayN", { day: dayOfIllness(startDate) })}</span>;
}

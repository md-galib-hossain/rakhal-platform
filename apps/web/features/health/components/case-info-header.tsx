"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import type { Locale } from "@/lib/constants/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@rakhal/ui/ui/avatar";
import { Chip } from "@rakhal/ui/ui/chip";
import { formatDate } from "@/lib/format";
import { AnimalLink } from "@/components/shared/animal-link";
import { diagnosisChipVariant, priorityChipVariant } from "../format";
import { ProgressRing } from "./progress-ring";
import type { HealthCaseDetail } from "../types";

function InfoTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-md border border-border p-3 min-w-0 overflow-hidden">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      {children}
    </div>
  );
}

/** Case Management sheet's top card (all 4 Figma frames share it): cattle avatar/name/tag, a
 * conditional Safety Withholding banner, then a 2×3 info grid (Location/Diagnosis/Priority,
 * Progress/Last Dose/Next Dose). */
export function CaseInfoHeader({ healthCase }: { healthCase: HealthCaseDetail }) {
  const t = useTranslations("health.caseSheet.header");
  const locale = useLocale() as Locale;
  const withdrawal = healthCase.activeSafetyWithdrawal;
  const safeDate = withdrawal?.safeMilkDate ?? withdrawal?.safeMeatDate;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-3">
      <div className="flex items-center gap-3">
        <AnimalLink
          id={healthCase.cattle.id}
          animalName={healthCase.cattle.name}
          tagNumber={healthCase.cattle.tagNumber}
          className="flex items-center gap-3 text-left group font-normal min-w-0"
        >
          <Avatar className="size-12 shrink-0">
            {healthCase.cattle.image ? <AvatarImage src={healthCase.cattle.image} alt="" /> : null}
            <AvatarFallback>{(healthCase.cattle.name ?? healthCase.cattle.tagNumber).slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <p className="text-base font-semibold text-foreground group-hover:underline truncate">{healthCase.cattle.name ?? healthCase.cattle.tagNumber}</p>
            <p className="text-sm text-muted-foreground truncate">{healthCase.cattle.tagNumber}</p>
          </div>
        </AnimalLink>
        {healthCase.isSafetyWithholdingActive && safeDate ? (
          <div className="flex flex-1 items-start gap-2 rounded-md bg-warning-tint px-3 py-2 text-warning min-w-0">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-xs font-medium">{t("safetyWithholdingActive", { date: formatDate(safeDate, locale) })}</p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <InfoTile label={t("location")}>
          <p className="text-sm font-medium text-foreground truncate" title={healthCase.shedName ?? "—"}>{healthCase.shedName ?? "—"}</p>
        </InfoTile>
        <InfoTile label={t("diagnosis")}>
          <div className="flex flex-col items-start gap-1 min-w-0 w-full">
            <Chip
              variant={diagnosisChipVariant(healthCase.condition ?? healthCase.note)}
              className="max-w-full"
              title={healthCase.condition ? t(`conditionValue.${healthCase.condition}`) : (healthCase.note ?? "—")}
            >
              <span className="truncate">
                {healthCase.condition ? t(`conditionValue.${healthCase.condition}`) : (healthCase.note ?? "—")}
              </span>
            </Chip>
            {healthCase.condition && healthCase.note ? (
              <p className="text-xs text-muted-foreground truncate max-w-full" title={healthCase.note}>{healthCase.note}</p>
            ) : null}
          </div>
        </InfoTile>
        <InfoTile label={t("priority")}>
          <Chip variant={priorityChipVariant(healthCase.priority)} className="max-w-full">
            <span className="truncate">{t(`priorityValue.${healthCase.priority}`)}</span>
          </Chip>
        </InfoTile>
        <InfoTile label={t("progress")}>
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-medium text-foreground shrink-0">
              {healthCase.currentStep}
              <span className="text-muted-foreground">/{healthCase.totalSteps || 0}</span>
            </p>
            <ProgressRing value={healthCase.progressPercentage} />
          </div>
        </InfoTile>
        <InfoTile label={t("lastDose")}>
          <p className="text-sm font-medium text-foreground truncate">
            {healthCase.lastDose ? formatDate(healthCase.lastDose.administeredAt, locale) : t("none")}
          </p>
        </InfoTile>
        <InfoTile label={t("nextDose")}>
          <p className="text-sm font-medium text-foreground truncate">
            {healthCase.nextDose ? formatDate(healthCase.nextDose.dueDateTime, locale) : t("none")}
          </p>
        </InfoTile>
      </div>
    </div>
  );
}

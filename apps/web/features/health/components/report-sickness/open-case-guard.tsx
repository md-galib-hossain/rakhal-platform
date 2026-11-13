"use client"; // reads the animal's open cases as soon as a cow is picked

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@rakhal/ui/ui/button";
import { useOpenCasesForCattle } from "../../hooks/use-health";
import type { HealthCaseListItem, HealthCondition } from "../../types";

/** Whole days since the case started, counting the start day as day 1 ("Day 3 of illness"). */
export function caseDay(startDate: string, now: Date = new Date()): number {
  const start = new Date(startDate);
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/** The open case that would make the backend reject this report ("Active health case already exists for this
 * diagnosis", 409): same structured condition. Returns it so the form can disable submit. */
export function findBlockingCase(cases: HealthCaseListItem[], condition: HealthCondition | undefined) {
  return condition ? cases.find((c) => c.condition === condition) : undefined;
}

/** RFE-133 — shown the moment an animal is picked, before anything is typed: an animal that already has an open
 * case gets a banner with a one-tap "Open case". Same condition → blocking (red); a different condition → a
 * heads-up (amber), since a cow can legitimately have two things wrong. */
export function OpenCaseGuard({
  cattleId,
  condition,
  animalName,
  onOpenCase,
}: {
  cattleId: string | undefined;
  condition: HealthCondition | undefined;
  animalName: string;
  onOpenCase: (caseId: string) => void;
}) {
  const t = useTranslations("health.reportSickness");
  const query = useOpenCasesForCattle(cattleId);
  const cases = query.data?.items ?? [];
  if (!cattleId || cases.length === 0) return null;

  const blocking = findBlockingCase(cases, condition);
  const shown = blocking ?? cases[0];
  const label = shown.condition ? t(`conditionValue.${shown.condition}`) : (shown.note ?? "—");

  return (
    <div
      role="alert"
      className={
        blocking
          ? "flex items-start gap-3 rounded-lg border border-destructive bg-destructive-tint p-3 text-sm"
          : "flex items-start gap-3 rounded-lg border border-warning bg-warning-tint p-3 text-sm"
      }
    >
      <AlertTriangle className={blocking ? "mt-0.5 size-4 shrink-0 text-destructive" : "mt-0.5 size-4 shrink-0 text-warning"} aria-hidden />
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-foreground">
          {t(blocking ? "openCaseSame" : "openCaseOther", { name: animalName, condition: label, day: caseDay(shown.startDate) })}
        </p>
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onOpenCase(shown.id)}>
          {t("openCase")}
        </Button>
      </div>
    </div>
  );
}

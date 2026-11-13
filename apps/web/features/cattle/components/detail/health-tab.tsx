"use client"; // live query

import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Skull } from "lucide-react";
import { cn } from "@/lib/utils";
import { WS_CARD } from "../workspace/workspace-grid";
import { Card } from "@rakhal/ui/ui/card";
import { Badge } from "@rakhal/ui/ui/badge";
import { Chip } from "@/components/ui/chip";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCattleHealthSummary } from "../../hooks/use-cattle-detail-tabs";
import { caseTitle } from "@/features/health/format";
import { AppliedProtocolChip } from "@/features/health/components/applied-protocol-chip";
import { CattleProtocolsSection } from "@/features/health/components/cattle-protocols-section";
import type { HealthCaseRow } from "../../detail-types";
import { AnimalHoldsPanel } from "./animal-holds-panel";

const CASE_STATUS_VARIANT: Record<string, "warning" | "success" | "destructive" | "secondary" | "info"> = {
  ACTIVE: "warning",
  IMPROVING: "info",
  WORSENING: "destructive",
  STABLE: "secondary",
  RECOVERED: "success",
  MORTALITY: "destructive",
  CLOSED: "secondary",
};

/** Vertical dose stepper (Figma "Single Cow Details" frame 1042:57994, node "Ongoing Treatment") —
 * a dashed connector line joining one circle per step: filled green+check for completed steps, an
 * outlined circle for the next pending one. Real-data caveat: the backend's `HealthCaseRow` only
 * exposes `currentStep`/`totalSteps` counts plus a flat `tasks[]` (future due dates) — no per-step
 * "given on" date for completed doses — so completed steps show a "Done" chip rather than a
 * fabricated given-date, and the next pending step's date comes from `tasks[0]` when present. */
function DoseStepper({ activeCase }: { activeCase: HealthCaseRow }) {
  const t = useTranslations("cattle.detail.health");
  const steps = Array.from({ length: activeCase.totalSteps }, (_, i) => activeCase.totalSteps - i);
  const nextDue = activeCase.tasks[0]?.dueDateTime;

  return (
    <div className="flex flex-col">
      {steps.map((stepNumber, i) => {
        const isDone = stepNumber <= activeCase.currentStep;
        const isNext = stepNumber === activeCase.currentStep + 1;
        const isLast = i === steps.length - 1;
        return (
          <div key={stepNumber} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  isDone ? "border-primary bg-primary text-secondary" : "border-border bg-card",
                )}
              >
                {isDone ? <Check className="size-3.5" aria-hidden /> : null}
              </span>
              {!isLast ? <span className="w-px flex-1 border-l border-dashed border-primary/40" /> : null}
            </div>
            <div className="flex flex-1 items-center justify-between gap-3 pb-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">{t("stepLabel", { n: stepNumber })}</p>
                {isNext && nextDue ? (
                  <p className="text-xs text-muted-foreground">
                    {t("estimatedDate")} <DateText date={nextDue} />
                  </p>
                ) : null}
              </div>
              {isDone ? (
                <Chip variant="primary">{t("done")}</Chip>
              ) : isNext ? (
                <Chip variant="warning">{t("dueSoon")}</Chip>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Health tab (Figma "Single Cow Details" frame 1042:57994) — `GET /cattle/:id/health-summary`.
 * Active cases render as a card with the vertical `DoseStepper` above; treatment history stays a
 * plain table matching the mock's row style. */
export function HealthTab({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.health");
  const tCondition = useTranslations("health.reportSickness");
  const query = useCattleHealthSummary(cattleId);

  if (query.isLoading) return <CardSkeleton lines={4} />;
  if (query.isError) {
    return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;
  }
  const data = query.data;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      {data.mortalityStatus ? (
        <Card className="flex items-center gap-3 border-destructive/40 bg-destructive-tint p-4">
          <Skull className="size-5 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="text-sm font-medium text-destructive">{t("mortalityRecorded")}</p>
            <p className="text-xs text-destructive/80">
              {data.mortalityStatus.primaryCauseOfDeath} — <DateText date={data.mortalityStatus.deathDate} />
            </p>
          </div>
        </Card>
      ) : null}

      {data.safetyWithdrawalWarning ? (
        <Card className="flex items-center gap-3 border-warning/40 bg-warning-tint p-4">
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm font-medium text-warning">{t("withholdingActive")}</p>
        </Card>
      ) : null}

      <CattleProtocolsSection cattleId={cattleId} />

      {data.activeCases.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("ongoingTreatment")}</h3>
          {data.activeCases.map((c) => (
            <Card key={c.id} className={`${WS_CARD} flex flex-col gap-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{caseTitle(c, (condition) => tCondition(`conditionValue.${condition}`))}</p>
                  {c.condition && c.note ? <p className="text-xs text-muted-foreground">{c.note}</p> : null}
                  <p className="text-xs text-muted-foreground">{c.caseCode}</p>
                  {c.healthPlan ? <AppliedProtocolChip name={c.healthPlan.name} className="mt-1.5" /> : null}
                </div>
                {c.totalSteps > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("progressLabel")}{" "}
                    <span className="font-semibold text-foreground">
                      {c.currentStep}/{c.totalSteps}
                    </span>
                  </p>
                ) : (
                  <Badge variant={CASE_STATUS_VARIANT[c.status] ?? "secondary"}>{c.status}</Badge>
                )}
              </div>
              {c.totalSteps > 0 ? <DoseStepper activeCase={c} /> : null}
            </Card>
          ))}
        </div>
      ) : null}

      <AnimalHoldsPanel cattleId={cattleId} />

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("treatmentHistory")}</h3>
        {data.treatmentHistory.length === 0 ? (
          <EmptyState title={t("noTreatments")} className="py-8" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.date")}</TableHead>
                <TableHead>{t("columns.medicine")}</TableHead>
                <TableHead>{t("columns.dose")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.treatmentHistory.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <DateText date={log.administeredAt} />
                  </TableCell>
                  <TableCell>{log.medicineName ?? "—"}</TableCell>
                  <TableCell>{log.doseAmount != null ? `${log.doseAmount} ${log.doseUnit ?? ""}` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

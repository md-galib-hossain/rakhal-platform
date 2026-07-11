"use client"; // live query

import { useTranslations } from "next-intl";
import { AlertTriangle, Skull } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCattleHealthSummary } from "../../hooks/use-cattle-detail-tabs";

const CASE_STATUS_VARIANT: Record<string, "warning" | "success" | "destructive" | "secondary" | "info"> = {
  ACTIVE: "warning",
  IMPROVING: "info",
  WORSENING: "destructive",
  STABLE: "secondary",
  RECOVERED: "success",
  MORTALITY: "destructive",
  CLOSED: "secondary",
};

/** Health tab (Figma B1-S8) — `GET /cattle/:id/health-summary`. Simplified vs the mock's
 * vertical-timeline vaccination stepper (`TimelineStepper`/`ProgressArc` — not built, too much
 * scope for one pass, PRD-spec flagged): active cases render as cards with a linear progress bar
 * instead, treatment history stays a plain table matching the mock's row style. */
export function HealthTab({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.health");
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

      {data.activeCases.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">{t("ongoingTreatment")}</h3>
          {data.activeCases.map((c) => (
            <Card key={c.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{c.diagnosis}</p>
                  <p className="text-xs text-muted-foreground">{c.caseCode}</p>
                </div>
                <Badge variant={CASE_STATUS_VARIANT[c.status] ?? "secondary"}>{c.status}</Badge>
              </div>
              {c.totalSteps > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("progress", { current: c.currentStep, total: c.totalSteps })}</span>
                    <span>{c.progressPercentage}%</span>
                  </div>
                  <Progress value={c.progressPercentage} />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("treatmentHistory")}</h3>
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

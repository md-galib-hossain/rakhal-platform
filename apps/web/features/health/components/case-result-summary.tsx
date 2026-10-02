"use client"; // reads the active locale for ৳ amounts

import { useTranslations } from "next-intl";
import { Repeat2 } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { MoneyText } from "@/components/shared/money-text";
import type { CaseSummary } from "../types";

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border p-2.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="text-sm font-semibold text-foreground">{children}</div>
    </div>
  );
}

/** RFE-135 — the case's result in four numbers (days, treatments, protocol, cost) + the outcome and a recurrence
 * badge. Closed → "Result" with the outcome; open → "So far", used on the Overview and as a preview above the Close
 * Case form so the decision is made with the facts in view. All figures come from `GET /health/cases/:id`'s
 * `summary` (RAKHAL-467) — nothing is computed here. */
export function CaseResultSummary({ summary }: { summary: CaseSummary }) {
  const t = useTranslations("health.caseSheet.overview.result");
  const closed = summary.outcome !== null;
  const recovered = summary.outcome === "RECOVERED";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-foreground">{closed ? t("titleClosed") : t("titleSoFar")}</p>
        {summary.outcome ? (
          <Chip variant={recovered ? "teal" : summary.outcome === "MORTALITY" ? "destructive" : "muted"}>
            {t(`outcome.${summary.outcome}`)}
          </Chip>
        ) : null}
        {summary.recurrence.isRecurrence ? (
          <Chip variant="warning" className="gap-1">
            <Repeat2 className="size-3" aria-hidden />
            {t("recurrence", { days: summary.recurrence.daysSincePrevious ?? 0 })}
          </Chip>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label={recovered ? t("daysToRecover") : t("daysSick")}>
          {t("days", { count: recovered && summary.daysToRecover != null ? summary.daysToRecover : summary.daysSick })}
        </Tile>
        <Tile label={t("treatments")}>{summary.treatmentCount}</Tile>
        <Tile label={t("protocol")}>
          {summary.protocol ? (
            <span className="flex flex-col">
              <span className="truncate">{summary.protocol.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {t("steps", { done: summary.stepsDone, total: summary.stepsTotal })}
              </span>
            </span>
          ) : (
            <span className="font-normal text-muted-foreground">{t("noProtocol")}</span>
          )}
        </Tile>
        <Tile label={t("cost")}>
          {summary.totalCost > 0 ? <MoneyText amount={summary.totalCost} /> : <span className="font-normal text-muted-foreground">—</span>}
        </Tile>
      </div>
    </div>
  );
}

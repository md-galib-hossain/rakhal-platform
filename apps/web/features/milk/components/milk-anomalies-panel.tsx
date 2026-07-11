"use client"; // list + review-dialog trigger state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Can } from "@/lib/auth/permissions";
import { useMilkAnomalies } from "../hooks/use-milk";
import type { MilkAnomaly } from "../types";
import { MilkCard } from "./milk-card";
import { ReviewAnomalyDialog } from "./review-anomaly-dialog";

/** Flagged sessions (<70% of the cow's 7-day average, `domain/milk-anomaly.ts#isAnomaly`) — backed
 * by the real `GET /milk/anomalies` (all dates, not scoped to today, since a worker may only spot
 * and review a drop days later). */
export function MilkAnomaliesPanel() {
  const t = useTranslations("milk.anomalies");
  const query = useMilkAnomalies();
  const [reviewing, setReviewing] = useState<MilkAnomaly | null>(null);

  if (query.isLoading) {
    return (
      <MilkCard title={t("title")} className="lg:col-span-3">
        <Table>
          <TableBody>
            <TableSkeleton rows={4} columns={6} />
          </TableBody>
        </Table>
      </MilkCard>
    );
  }
  if (query.isError) {
    return (
      <MilkCard title={t("title")} className="lg:col-span-3">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </MilkCard>
    );
  }

  const anomalies = query.data?.anomalies ?? [];

  return (
    <MilkCard title={t("title")} className="lg:col-span-3">
      {anomalies.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t("empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.cattle")}</TableHead>
              <TableHead>{t("columns.date")}</TableHead>
              <TableHead>{t("columns.session")}</TableHead>
              <TableHead>{t("columns.yield")}</TableHead>
              <TableHead>{t("columns.drop")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {anomalies.map((anomaly) => (
              <TableRow key={anomaly.id}>
                <TableCell>
                  <span className="font-medium text-foreground">{anomaly.name ?? anomaly.tag}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{anomaly.tag}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{anomaly.date}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{anomaly.session.toLowerCase()}</TableCell>
                <TableCell>{anomaly.yieldL} L</TableCell>
                <TableCell className="text-destructive">
                  {anomaly.dropPct != null ? `-${anomaly.dropPct}%` : "—"}
                </TableCell>
                <TableCell>
                  {anomaly.reviewed ? (
                    <Badge variant="success">{t("reviewed")}</Badge>
                  ) : (
                    <Badge variant="warning">{t("pending")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {!anomaly.reviewed ? (
                    <Can I="milk.update">
                      <Button variant="outline" size="sm" onClick={() => setReviewing(anomaly)}>
                        {t("review")}
                      </Button>
                    </Can>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ReviewAnomalyDialog anomaly={reviewing} open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)} />
    </MilkCard>
  );
}

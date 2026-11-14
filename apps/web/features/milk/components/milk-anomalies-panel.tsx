"use client"; // list + review-dialog trigger state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { AnimalLink } from "@/components/shared/animal-link";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Can } from "@/lib/auth/permissions";
import { useMilkAnomalies } from "../hooks/use-milk";
import type { MilkAnomaly } from "../types";
import { MilkCard } from "./milk-card";
import { ReviewAnomalyDialog } from "./review-anomaly-dialog";

/** Flagged sessions (<70% of the cow's 7-day average, `domain/milk-anomaly.ts#isAnomaly`) — backed
 * by the real `GET /milk/anomalies` (all dates, not scoped to today, since a worker may only spot
 * and review a drop days later). Cursor "load more" (RD-058) — a farm with 200+ flagged rows used
 * to load them all in one unbounded response. */
export function MilkAnomaliesPanel() {
  const t = useTranslations("milk.anomalies");
  const query = useMilkAnomalies();
  const [reviewing, setReviewing] = useState<MilkAnomaly | null>(null);
  const anomalies = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  if (query.isLoading) {
    return (
      <MilkCard title={t("title")} className="lg:col-span-5">
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
      <MilkCard title={t("title")} className="lg:col-span-5">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </MilkCard>
    );
  }

  return (
    <MilkCard title={t("title")} className="lg:col-span-5">
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
                  <AnimalLink id={anomaly.cattleId} animalName={anomaly.name} tagNumber={anomaly.tag} className="font-medium text-foreground" />
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
      {query.hasNextPage ? (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? t("loading") : t("loadMore")}
          </Button>
        </div>
      ) : null}
      <ReviewAnomalyDialog anomaly={reviewing} open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)} />
    </MilkCard>
  );
}

"use client"; // live query

import { useTranslations } from "next-intl";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCattleCalvingEvents, useCattleReproductionSummary } from "../../hooks/use-cattle-detail-tabs";
import type { CattleGender } from "../../types";

interface CalvingRow {
  eventId: string;
  calvingDate: string;
  calf: { id: string; gender: CattleGender; birthWeight: number | null } | null;
}

/** Reproduction tab (Figma B1-S7) — `GET /cattle/:id/reproduction-summary` + `GET
 * /reproduction/calving-events?cattleId=` for the history table. Female-only on the backend
 * (`getFemaleCattle` 400s for male/castrated) — gated here rather than firing a doomed request. */
export function ReproductionTab({ cattleId, gender }: { cattleId: string; gender: CattleGender }) {
  const t = useTranslations("cattle.detail.reproduction");
  const isFemale = gender === "FEMALE";
  const summary = useCattleReproductionSummary(cattleId, isFemale);
  const calvings = useCattleCalvingEvents(cattleId, isFemale);

  if (!isFemale) {
    return <EmptyState title={t("notApplicable")} description={t("notApplicableDescription")} className="py-16" />;
  }

  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }
  if (summary.isError) {
    return <ErrorState description={t("error")} onRetry={() => summary.refetch()} />;
  }
  const data = summary.data;
  if (!data) return null;

  const rows = (calvings.data?.items ?? []).flatMap<CalvingRow>((event) =>
    event.calfBirths.length > 0
      ? event.calfBirths.map((calf) => ({ eventId: event.id, calvingDate: event.calvingDate, calf }))
      : [{ eventId: event.id, calvingDate: event.calvingDate, calf: null }],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("totalCalvings")} value={data.totalCalvings} />
        <StatCard
          label={t("calvingInterval")}
          value={data.averageCalvingInterval != null ? t("days", { value: data.averageCalvingInterval }) : "—"}
        />
        <StatCard
          label={t("conceptionRate")}
          value={data.conceptionRate != null ? `${Math.round(data.conceptionRate * 100)}%` : "—"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("calvingHistory")}</h3>
        {rows.length === 0 ? (
          <EmptyState title={t("noCalvings")} className="py-8" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.date")}</TableHead>
                <TableHead>{t("columns.calfGender")}</TableHead>
                <TableHead>{t("columns.birthWeight")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.eventId}-${i}`}>
                  <TableCell>
                    <DateText date={row.calvingDate} />
                  </TableCell>
                  <TableCell>{row.calf ? t(`genderOptions.${row.calf.gender}`) : "—"}</TableCell>
                  <TableCell>{row.calf?.birthWeight != null ? t("kg", { value: row.calf.birthWeight }) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

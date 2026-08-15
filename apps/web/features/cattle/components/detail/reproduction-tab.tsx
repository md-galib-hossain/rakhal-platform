"use client"; // live query

import { useTranslations } from "next-intl";
import { Mars, Venus } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCattleCalvingEvents, useCattleReproductionSummary } from "../../hooks/use-cattle-detail-tabs";
import type { AnimalCategory, CattleGender } from "../../types";
import { PregnancyCalvingCard } from "./pregnancy-calving-card"; // RAKHAL-317-F

interface CalvingRow {
  eventId: string;
  calvingDate: string;
  calf: { id: string; gender: CattleGender; birthWeight: number | null } | null;
}

/** Figma's "male-symbol"/"female-symbol" glyph next to the gender label — same pattern as the
 * cattle list's `GenderGlyph` (cattle-columns.tsx). */
function GenderGlyph({ gender }: { gender: CattleGender }) {
  if (gender === "FEMALE") return <Venus className="size-3.5 text-accent-pink" aria-hidden />;
  return <Mars className="size-3.5 text-info" aria-hidden />;
}

/** Reproduction tab (Figma B1-S7) — `GET /cattle/:id/reproduction-summary` + `GET
 * /reproduction/calving-events?cattleId=` for the history table. Female-only on the backend
 * (`getFemaleCattle` 400s for male/castrated) — gated here rather than firing a doomed request. */
export function ReproductionTab({
  cattleId,
  gender,
  animalCategory,
}: {
  cattleId: string;
  gender: CattleGender;
  animalCategory: AnimalCategory;
}) {
  const t = useTranslations("cattle.detail.reproduction");
  const isFemale = gender === "FEMALE";
  const isImmature = animalCategory === "CALF";
  const summary = useCattleReproductionSummary(cattleId, isFemale && !isImmature);
  const calvings = useCattleCalvingEvents(cattleId, isFemale && !isImmature);

  if (isImmature) {
    return (
      <EmptyState
        title={t("notApplicableImmature")}
        description={t("notApplicableImmatureDescription")}
        className="py-16"
      />
    );
  }
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
      {/* RAKHAL-317-F — calculated-vs-farmer-expected calving date, only renders when pregnant. */}
      <PregnancyCalvingCard cattleId={cattleId} />

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
                <TableHead>{t("columns.calfId")}</TableHead>
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
                  <TableCell className="font-mono text-xs">{row.calf?.id ?? "—"}</TableCell>
                  <TableCell>
                    {row.calf ? (
                      <span className="flex items-center gap-1.5">
                        {t(`genderOptions.${row.calf.gender}`)}
                        <GenderGlyph gender={row.calf.gender} />
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
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

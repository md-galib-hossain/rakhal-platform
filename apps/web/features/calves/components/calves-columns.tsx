"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Mars, Venus, X } from "lucide-react";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import type { CalfListItem, CalfStage } from "../types";

/** `CASTRATED_MALE` still reads as male — same convention as `cattle-columns.tsx`'s `GenderGlyph`. */
function GenderGlyph({ gender }: { gender: CalfListItem["gender"] }) {
  if (gender === "FEMALE") return <Venus className="size-3.5 text-accent-pink" aria-hidden />;
  return <Mars className="size-3.5 text-info" aria-hidden />;
}

const STAGE_VARIANT: Record<CalfStage, ChipProps["variant"]> = {
  newborn: "info",
  young: "teal",
  pre_weaning: "warning",
  post_weaning: "muted",
};

/** Column set for the Calves list (RFE-033, no Figma frame): name/tag, age, gender, dam, stage,
 * weight (birth→current), health status, fed-today, weaning due date. No row-actions column —
 * clicking the calf name opens the detail sheet (no per-row edit/archive exists for calves). */
export function buildCalfColumns(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  rowActions: { onView: (calf: CalfListItem) => void },
): ColumnDef<CalfListItem, unknown>[] {
  return [
    {
      id: "calf",
      header: t("columns.calf"),
      cell: ({ row }) => {
        const calf = row.original;
        return (
          <button
            type="button"
            onClick={() => rowActions.onView(calf)}
            className="flex flex-col gap-0.5 text-left hover:underline"
          >
            <span className="text-sm font-medium text-foreground">{calf.name ?? calf.tagNumber}</span>
            <span className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{calf.tagNumber}</span>
              <GenderGlyph gender={calf.gender} />
            </span>
          </button>
        );
      },
    },
    {
      id: "age",
      header: t("columns.age"),
      cell: ({ row }) => t("ageDays", { value: row.original.ageDays }),
    },
    {
      id: "dam",
      header: t("columns.dam"),
      cell: ({ row }) => row.original.dam?.name ?? row.original.dam?.tagNumber ?? "—",
    },
    {
      id: "stage",
      header: t("columns.stage"),
      cell: ({ row }) => (
        <Chip variant={STAGE_VARIANT[row.original.stage]}>{t(`stage.${row.original.stage}`)}</Chip>
      ),
    },
    {
      id: "weight",
      header: t("columns.weight"),
      cell: ({ row }) => {
        const { birthWeightKg, currentWeightKg } = row.original;
        if (currentWeightKg == null) return birthWeightKg != null ? `${birthWeightKg} kg` : "—";
        return `${currentWeightKg} kg`;
      },
    },
    {
      id: "healthStatus",
      header: t("columns.health"),
      cell: ({ row }) => (
        <Chip variant={row.original.healthStatus === "concern" ? "destructive" : "primary"}>
          {t(`healthStatus.${row.original.healthStatus}`)}
        </Chip>
      ),
    },
    {
      id: "fedToday",
      header: t("columns.fedToday"),
      cell: ({ row }) =>
        row.original.fedToday ? (
          <Check className="size-4 text-success" aria-hidden />
        ) : (
          <X className="size-4 text-muted-foreground" aria-hidden />
        ),
    },
    {
      id: "weaningDue",
      header: t("columns.weaningDue"),
      cell: ({ row }) =>
        row.original.weaningDueDate ? <DateText date={row.original.weaningDueDate} /> : "—",
    },
  ];
}

"use client"; // tooltip open state

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertCircle, AlertTriangle, Check, Info } from "lucide-react";
import { Can } from "@/lib/auth/permissions";
import { Badge } from "@rakhal/ui/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { FeedFitSeverity, FeedGridProgramCowFields } from "../../feed/plans-types";

const NUTRIENT_STATUS = {
  ok: {
    bg: "bg-success-tint hover:bg-success-tint/80",
    text: "text-success",
    dot: "bg-success",
  },
  warn: {
    bg: "bg-warning-tint hover:bg-warning-tint/80",
    text: "text-warning",
    dot: "bg-warning",
  },
  bad: {
    bg: "bg-destructive-tint hover:bg-destructive-tint/80",
    text: "text-destructive",
    dot: "bg-destructive",
  },
} as const satisfies Record<
  FeedFitSeverity,
  { bg: string; text: string; dot: string }
>;

const STATUS_VARIANT = {
  ok: "success",
  warn: "warning",
  bad: "destructive",
} as const satisfies Record<FeedFitSeverity, "success" | "warning" | "destructive">;

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
const pct = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : ""}${fmt(n)}%`);

/**
 * Segmented 3-Nutrient Mini Bar (DM · CP · ME) for per-cow fit.
 * Shows a compact segmented bar with green / amber / red status per nutrient,
 * plus discrete "Est." and "Manual" tags when applicable. Hovering reveals
 * full nutrient breakdown, requirement targets, and context warnings.
 */
export function FitPill({
  fit,
  requirement,
  supply,
  cattleId,
}: Pick<FeedGridProgramCowFields, "fit" | "requirement"> & {
  supply: FeedGridProgramCowFields["planned_supply"];
  /** Enables the "Change requirement" link for a manual cow. */
  cattleId?: string;
}) {
  const t = useTranslations("feeding.programs.fit");
  if (!fit) return <span className="text-xs text-muted-foreground">{t("none")}</span>;

  const manual = requirement?.source === "MANUAL" ? requirement.manual : undefined;
  const rows = [
    { key: "dm", unit: "kg", req: requirement?.dm_kg, sup: supply?.dm_kg, delta: fit.dm.delta_pct },
    { key: "cp", unit: "kg", req: requirement?.cp_kg, sup: supply?.cp_kg, delta: fit.cp.delta_pct },
    { key: "me", unit: "MJ", req: requirement?.me_mj, sup: supply?.me_mj, delta: fit.me.delta_pct },
  ] as const;

  const nutrientKeys = [
    { key: "dm", label: "DM" },
    { key: "cp", label: "CP" },
    { key: "me", label: "ME" },
  ] as const;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg text-left transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-ring"
          >
            {/* Segmented 3-nutrient mini bar */}
            <div className="inline-flex items-center overflow-hidden rounded-md border border-border bg-card shadow-2xs">
              {nutrientKeys.map((item, index) => {
                const nutrientFit = fit[item.key];
                const status = NUTRIENT_STATUS[nutrientFit.severity];
                return (
                  <div key={item.key} className="flex items-center">
                    {index > 0 ? <div className="h-4 w-px bg-border/80" aria-hidden /> : null}
                    <div
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold transition-colors",
                        status.bg,
                        status.text,
                      )}
                    >
                      <span>{item.label}</span>
                      <span className={cn("size-1.5 rounded-full shrink-0", status.dot)} aria-hidden />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Estimated tag */}
            {fit.estimated ? (
              <span
                className="inline-flex items-center rounded-md border border-border/80 bg-muted/70 px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {t("estShort")}
              </span>
            ) : null}

            {/* Manual tag */}
            {requirement?.source === "MANUAL" ? (
              <span
                className="inline-flex items-center rounded-md border border-border/80 bg-muted/70 px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {t("manualShort")}
              </span>
            ) : null}
          </button>
        </TooltipTrigger>

        <TooltipContent className="max-w-xs space-y-2.5 p-3">
          {/* Header with status badge */}
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
            <span className="text-xs font-semibold text-foreground">{t("title")}</span>
            <Badge variant={STATUS_VARIANT[fit.severity]} className="gap-1 px-2 py-0.5 text-xs">
              {fit.severity === "ok" ? (
                <Check className="size-3" aria-hidden />
              ) : fit.severity === "warn" ? (
                <AlertTriangle className="size-3" aria-hidden />
              ) : (
                <AlertCircle className="size-3" aria-hidden />
              )}
              {t(`status.${fit.severity}`)}
            </Badge>
          </div>

          {/* Nutrient breakdown table */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="pb-1 text-left font-medium">{t("nutrientHeader")}</th>
                <th className="pb-1 pr-2 text-right font-medium">{t("needs")}</th>
                <th className="pb-1 pr-2 text-right font-medium">{t("gets")}</th>
                <th className="pb-1 text-right font-medium">{t("variance")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {rows.map((r) => {
                const severity = fit[r.key].severity;
                const deltaColor =
                  severity === "ok"
                    ? "text-success"
                    : severity === "warn"
                      ? "text-warning font-medium"
                      : "text-destructive font-semibold";
                return (
                  <tr key={r.key}>
                    <td className="py-1 font-medium text-foreground">{t(`nutrient.${r.key}`)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">
                      {r.req != null ? `${fmt(r.req)} ${r.unit}` : "—"}
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums text-foreground">
                      {r.sup != null ? `${fmt(r.sup)} ${r.unit}` : "—"}
                    </td>
                    <td className={cn("py-1 text-right tabular-nums", deltaColor)}>{pct(r.delta)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Estimated note */}
          {fit.estimated ? (
            <div className="flex items-start gap-1.5 rounded-md bg-muted/60 p-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>{t("estimatedTooltip")}</span>
            </div>
          ) : null}

          {/* Incomplete stock notice */}
          {supply && !supply.complete ? (
            <div className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{t("incomplete")}</span>
            </div>
          ) : null}

          {manual ? <p className="text-xs text-muted-foreground">{t("manualNote")}</p> : null}

          {manual?.stale ? (
            <p className="text-xs text-warning">
              {manual.animal_type_changed
                ? t("manualStaleType")
                : t("manualStale", {
                    pct: Math.round(Math.max(manual.drift.dm_pct, manual.drift.cp_pct, manual.drift.me_pct)),
                  })}
            </p>
          ) : null}

          {manual && cattleId ? (
            <Can I="feed.update">
              {/* `/animals/:id` redirects to `?view=` and drops `tab`, so link to the drawer directly. */}
              <Link
                href={`/animals?view=${cattleId}&tab=feeding`}
                className="mt-1 block text-xs font-medium text-primary underline"
              >
                {t("changeRequirement")}
              </Link>
            </Can>
          ) : null}

          {requirement?.flags.length ? (
            <p className="text-xs text-muted-foreground">
              {requirement.flags.map((f) => f.replace(/_/g, " ")).join(", ")}
            </p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

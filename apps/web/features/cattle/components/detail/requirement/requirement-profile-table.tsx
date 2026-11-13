import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedRequirements } from "@/features/feed/types";
import { Badge } from "@rakhal/ui/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@rakhal/ui/ui/tooltip";
import { PROFILE_SECTIONS, diffPct, fmt } from "./profile";

/** Info icon + "how this is worked out" tooltip, shared by the read-only table and the edit form. */
function FormulaHint({ formulaKey }: { formulaKey: string }) {
  const t = useTranslations("cattle.feeding.requirement.formula");
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("triggerLabel")}
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{t(formulaKey)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const changeText = (pct: number | null) => (pct === null ? "" : `${pct > 0 ? "+" : ""}${Math.round(pct)}%`);

/**
 * The whole nutrient profile, read-only (MILESTONE 28b, RFE-131).
 * - Calculated mode shows a clean table view of today's calculated figures.
 * - A saved manual requirement shows the manual figure beside the calculated one with the difference %,
 *   so a manager can clearly see what was overridden.
 */
export function RequirementProfileTable({
  calculated,
  manual,
}: {
  calculated: FeedRequirements;
  /** The manual requirement in force; omit for the plain calculated view. */
  manual?: FeedRequirements | null;
}) {
  const t = useTranslations("cattle.feeding.requirement");
  const sideBySide = Boolean(manual);

  return (
    <div className="flex flex-col gap-4">
      {PROFILE_SECTIONS.map((section) => (
        <section key={section.key} aria-label={t(`sections.${section.key}`)} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(`sections.${section.key}`)}
            </h3>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
            {sideBySide ? (
              <div
                aria-hidden
                className="hidden grid-cols-[minmax(0,1.6fr)_1.1fr_1.1fr_4.5rem] items-center gap-2 border-b border-border/70 bg-muted/40 px-3.5 py-2 text-xs font-semibold text-muted-foreground sm:grid"
              >
                <span>{t("nutrient")}</span>
                <span className="text-right">{t("col.manual")}</span>
                <span className="text-right">{t("col.calculated")}</span>
                <span className="text-right">{t("col.change")}</span>
              </div>
            ) : (
              <div
                aria-hidden
                className="hidden grid-cols-[minmax(0,1fr)_auto] items-center justify-between border-b border-border/70 bg-muted/40 px-3.5 py-2 text-xs font-semibold text-muted-foreground sm:grid"
              >
                <span>{t("nutrient")}</span>
                <span className="text-right">{t("col.calculated")}</span>
              </div>
            )}

            <ul className="flex flex-col divide-y divide-border/60">
              {section.rows.map((row) => {
                const c = calculated[row.reqKey] as number | null | undefined;
                const m = manual ? (manual[row.reqKey] as number | null | undefined) : undefined;
                const diff = sideBySide ? diffPct(m, c) : null;
                const change = changeText(diff);

                return (
                  <li
                    key={row.nutrient}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-sm transition-colors hover:bg-muted/30",
                      sideBySide && "sm:grid-cols-[minmax(0,1.6fr)_1.1fr_1.1fr_4.5rem]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-foreground">
                        {t(`nutrients.${row.nutrient}`)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({row.unit})
                      </span>
                      {row.kind === "derived" ? (
                        <>
                          <Badge
                            variant="outline"
                            className="h-4 border-border/60 bg-muted/60 px-1.5 text-xs font-normal text-muted-foreground"
                          >
                            {t("derivedBadge")}
                          </Badge>
                          <FormulaHint formulaKey={row.formulaKey} />
                        </>
                      ) : null}
                    </div>

                    {sideBySide ? (
                      <>
                        <span className="text-right font-semibold tabular-nums text-foreground">
                          {fmt(m)} <span className="text-xs font-normal text-muted-foreground">{row.unit}</span>
                        </span>
                        <div className="col-span-2 flex items-center justify-between text-xs text-muted-foreground sm:hidden">
                          <span>{t("col.calculated")}: <strong className="font-medium text-foreground">{fmt(c)} {row.unit}</strong></span>
                          {change ? (
                            <span className={cn("rounded-sm px-1 font-medium", diff && diff > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                              {change}
                            </span>
                          ) : null}
                        </div>
                        <span className="hidden text-right tabular-nums text-muted-foreground sm:block">
                          {fmt(c)} <span className="text-xs">{row.unit}</span>
                        </span>
                        <span className="hidden text-right text-xs tabular-nums font-medium sm:block">
                          {diff !== null ? (
                            <Badge
                              variant={Math.abs(diff) > 20 ? "warning" : "outline"}
                              className="h-5 px-1.5 text-xs"
                            >
                              {change}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </span>
                      </>
                    ) : (
                      <span className="text-right font-semibold tabular-nums text-foreground">
                        {fmt(c)} <span className="text-xs font-normal text-muted-foreground">{row.unit}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}

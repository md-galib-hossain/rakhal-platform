"use client"; // tooltip open state

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Progress } from "@rakhal/ui/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@rakhal/ui/ui/tooltip";
import type { requirementProgress } from "../grid-model";

type Result = NonNullable<ReturnType<typeof requirementProgress>>;

const fmt = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);

/**
 * Per-cow bar of how much of her daily requirement today's CONFIRMED feedings cover: empty until feeding is confirmed, full once dry
 * matter, protein and energy are all met (the lowest of the three drives the fill). The tooltip breaks it down.
 */
export function RequirementProgress({ progress }: { progress: Result | null }) {
  const t = useTranslations("feeding.grid.requirementBar");
  if (!progress) return <span className="font-mono text-xs text-muted-foreground/40">—</span>;

  const rows = [
    { key: "dm", value: progress.dm },
    { key: "cp", value: progress.cp },
    { key: "me", value: progress.me },
  ] as const;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex w-full flex-col gap-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={t("aria", { pct: Math.round(progress.overall) })}
          >
            <Progress value={progress.overall} className="h-2.5" />
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                progress.overall >= 100 ? "text-success" : "text-muted-foreground",
              )}
            >
              {fmt(progress.overall)}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          <p className="mb-1 font-medium">{t("title")}</p>
          <table>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="pr-3">{t(`nutrient.${r.key}`)}</td>
                  <td className="text-right tabular-nums">{fmt(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

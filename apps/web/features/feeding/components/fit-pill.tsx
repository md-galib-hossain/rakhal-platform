"use client"; // tooltip open state

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FeedFitSeverity, FeedGridProgramCowFields } from "../../feed/plans-types";

const VARIANT = { ok: "success", warn: "warning", bad: "destructive" } as const satisfies Record<
  FeedFitSeverity,
  "success" | "warning" | "destructive"
>;

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
const pct = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : ""}${fmt(n)}%`);

/**
 * Per-cow fit pill (MILESTONE 27, RFE-128): green / amber / red for how her program's supply meets her daily DM, CP and
 * ME needs. "Estimated" is appended when an input was assumed — never green without data. The tooltip lists
 * requirement vs supply per nutrient and the backend's flags.
 */
export function FitPill({
  fit,
  requirement,
  supply,
}: Pick<FeedGridProgramCowFields, "fit" | "requirement"> & { supply: FeedGridProgramCowFields["planned_supply"] }) {
  const t = useTranslations("feeding.programs.fit");
  if (!fit) return <span className="text-xs text-muted-foreground">{t("none")}</span>;

  const rows = [
    { key: "dm", unit: "kg", req: requirement?.dm_kg, sup: supply?.dm_kg, delta: fit.dm.delta_pct },
    { key: "cp", unit: "kg", req: requirement?.cp_kg, sup: supply?.cp_kg, delta: fit.cp.delta_pct },
    { key: "me", unit: "MJ", req: requirement?.me_mj, sup: supply?.me_mj, delta: fit.me.delta_pct },
  ] as const;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="rounded-full focus-visible:outline-2 focus-visible:outline-ring">
            <Badge variant={VARIANT[fit.severity]}>
              {t(fit.severity)}
              {fit.estimated ? ` · ${t("estimated")}` : ""}
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <table className="text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pr-3 text-left font-normal" />
                <th className="pr-3 text-right font-normal">{t("needs")}</th>
                <th className="pr-3 text-right font-normal">{t("gets")}</th>
                <th className="text-right font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="pr-3 font-medium">{t(`nutrient.${r.key}`)}</td>
                  <td className="pr-3 text-right tabular-nums">{r.req != null ? `${fmt(r.req)} ${r.unit}` : "—"}</td>
                  <td className="pr-3 text-right tabular-nums">{r.sup != null ? `${fmt(r.sup)} ${r.unit}` : "—"}</td>
                  <td className="text-right tabular-nums">{pct(r.delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {supply && !supply.complete ? <p className="mt-1 text-warning">{t("incomplete")}</p> : null}
          {requirement?.flags.length ? (
            <p className="mt-1 text-muted-foreground">{requirement.flags.map((f) => f.replace(/_/g, " ")).join(", ")}</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

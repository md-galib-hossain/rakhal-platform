import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { HealthPlanStats } from "../types";

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "warn" }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border p-2.5">
      <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-bold leading-none text-foreground", tone === "good" && "text-success", tone === "warn" && "text-warning")}>{value}</span>
      {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

const pct = (value: number) => `${Math.round(value)}%`;

/** RFE-136 / EPIC D8 — what this protocol has actually achieved on the farm (`stats` from `GET /health/plans`,
 * RAKHAL-466). The headline is the number that matters for the protocol's kind: recovery rate for a treatment,
 * coverage rate for a prevention round. A rate is `null` until there is something to divide by, shown as "—" with a
 * "no result yet" hint, never as a made-up 0 %. A protocol nobody has used reads "Not used yet". */
export function ProtocolResultStats({ stats }: { stats: HealthPlanStats }) {
  const t = useTranslations("health.healthPlan.stats");

  if (stats.appliedTo === 0) {
    return <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t("notUsed")}</p>;
  }

  if (stats.kind === "TREATMENT") {
    const rate = stats.recoveryRate;
    return (
      <div className="flex gap-2" role="group" aria-label={t("treatmentLabel")}>
        <Tile label={t("appliedTo")} value={String(stats.appliedTo)} hint={t("animals", { count: stats.appliedTo })} />
        <Tile
          label={t("recoveryRate")}
          value={rate == null ? "—" : pct(rate)}
          tone={rate == null ? undefined : rate >= 70 ? "good" : "warn"}
          hint={rate == null ? t("noResultYet") : t("recoveredDied", { recovered: stats.recovered ?? 0, died: stats.mortality ?? 0 })}
        />
        <Tile label={t("inProgress")} value={String(stats.inProgress)} hint={t("cases", { count: stats.inProgress })} />
      </div>
    );
  }

  const coverage = stats.coverageRate;
  return (
    <div className="flex gap-2" role="group" aria-label={t("preventionLabel")}>
      <Tile label={t("appliedTo")} value={String(stats.appliedTo)} hint={t("animals", { count: stats.appliedTo })} />
      <Tile
        label={t("coverage")}
        value={coverage == null ? "—" : pct(coverage)}
        tone={coverage == null ? undefined : coverage >= 80 ? "good" : "warn"}
        hint={t("completedCount", { count: stats.completed ?? 0 })}
      />
      <Tile label={t("stepsDue")} value={String(stats.due ?? 0)} tone={(stats.due ?? 0) > 0 ? "warn" : undefined} hint={t("dueHint")} />
    </div>
  );
}

import { useFormatter, useTranslations } from "next-intl";
import { Chip } from "@/components/ui/chip";
import type { HealthPlanStats } from "../types";

/** `YYYY-MM-DD` (the farm's calendar day) as a local `Date` at noon, so formatting it never slips a day across zones. */
function dayOf(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * RFE-142 / EPIC D12 — what this protocol is doing on the farm *right now*, on its card: how many animals are on it,
 * and — only when there is something to say — steps overdue, steps due today, or else the next due day. Numbers come from
 * `stats` on `GET /health/plans` (RAKHAL-470; the farm's calendar day, computed on the server). Nothing is shown for a
 * protocol with no animal on it: its card already says "Not used yet", and an empty "0 in progress" row is noise.
 * Overdue is shown on the row it belongs to, never as a page-level alert.
 */
export function ProtocolLiveState({ stats }: { stats: HealthPlanStats }) {
  const t = useTranslations("health.healthPlan.live");
  const format = useFormatter();

  if (stats.inProgress === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" role="group" aria-label={t("label")}>
      <span className="text-sm font-semibold text-foreground">{t("inProgress", { count: stats.inProgress })}</span>
      {stats.stepsOverdue > 0 ? <Chip variant="destructive">{t("overdue", { count: stats.stepsOverdue })}</Chip> : null}
      {stats.stepsDue > 0 ? <Chip variant="warning">{t("dueToday", { count: stats.stepsDue })}</Chip> : null}
      {stats.stepsOverdue === 0 && stats.stepsDue === 0 && stats.nextDueDate ? (
        <span className="text-xs text-muted-foreground">
          {t("nextStep", { date: format.dateTime(dayOf(stats.nextDueDate), { day: "numeric", month: "short" }) })}
        </span>
      ) : null}
    </div>
  );
}

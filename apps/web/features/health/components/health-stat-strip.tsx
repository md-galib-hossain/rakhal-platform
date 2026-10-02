"use client"; // live query + URL-synced navigation (the sick / withheld tiles open that Sick Bay view)

import { useLocale, useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryStates } from "nuqs";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealthDashboard } from "../hooks/use-health";
import { HEALTH_MANAGEMENT_TABS, SICK_BAY_VIEWS, type HealthManagementTab, type SickBayView } from "../types";

const TAB_KEYS = HEALTH_MANAGEMENT_TABS as unknown as [HealthManagementTab, ...HealthManagementTab[]];
const VIEW_KEYS = SICK_BAY_VIEWS as unknown as [SickBayView, ...SickBayView[]];

function Stat({
  label,
  value,
  caption,
  onClick,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  caption?: string;
  /** When set the tile is a button that jumps to the matching list. */
  onClick?: () => void;
  tone?: "warning";
}) {
  const body = (
    <>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-xl font-bold text-foreground", tone === "warning" && "text-warning")}>{value}</span>
      {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
    </>
  );
  const base = "flex min-h-[76px] flex-col items-start justify-center gap-0.5 bg-card px-4 py-3 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(base, "transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring")}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}

/**
 * RFE-140 (MILESTONE 29c) — the one-row summary at the top of Healthcare, replacing the 420px Key Metrics ring card, the
 * trend chart and the outcomes card (those two live in the Insights tab now). Four numbers from the existing
 * `GET /health/dashboard`: animals sick now, herd healthy share, animals with milk/meat withheld, medicine cost
 * (all-time, as the endpoint returns it). The first and third are buttons that open that Sick Bay view.
 */
export function HealthStatStrip() {
  const t = useTranslations("health.stat");
  const locale = useLocale() as Locale;
  const query = useHealthDashboard();
  const [, setParams] = useQueryStates({
    healthTab: parseAsStringEnum<HealthManagementTab>(TAB_KEYS),
    view: parseAsStringEnum<SickBayView>(VIEW_KEYS),
  });

  if (query.isLoading) return <Skeleton className="h-[78px] w-full rounded-2xl" />;
  if (query.isError || !query.data) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span>{t("error")}</span>
        <button type="button" onClick={() => void query.refetch()} className="font-medium text-primary hover:underline">
          {t("retry")}
        </button>
      </div>
    );
  }
  const data = query.data;
  const open = (view: SickBayView) => void setParams({ healthTab: "treatments", view });

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-card sm:grid-cols-4">
      <Stat label={t("sick")} value={data.sickBayCount} caption={t("sickCaption")} onClick={() => open("cases")} />
      <Stat label={t("healthy")} value={`${data.herdHealthScore}%`} caption={t("healthyCaption", { healthy: data.healthyAnimalCount, total: data.totalAnimalCount })} />
      <Stat
        label={t("withheld")}
        value={data.safetyWithdrawalCount}
        caption={t("withheldCaption")}
        tone={data.safetyWithdrawalCount > 0 ? "warning" : undefined}
        onClick={() => open("withheld")}
      />
      <Stat label={t("medicine")} value={formatMoney(data.medicineExpense, locale)} caption={t("medicineCaption")} />
    </div>
  );
}

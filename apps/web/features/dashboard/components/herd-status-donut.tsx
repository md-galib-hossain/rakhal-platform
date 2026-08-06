"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useHerdStatus } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";
import type { DonutSlice } from "./herd-status-chart-inner";

/** Deep-links a legend slice to the matching Cattle-page filter (nuqs-synced query params
 * `CattleFilters`/`CattleTable` already read) — `undefined` leaves the slice a plain "/cattle"
 * link (e.g. calves, which the list page filters via `purpose=CALF` in the category tabs, not a
 * dashboard-known param).
 *
 * `fresh`/`growing` used to link via `productionStatus=FRESH|GROWING` — RAKHAL-269 v2 dropped
 * those values from `ProductionStatus` (trimmed to MILKING/DRY). The backend's own dashboard
 * service computes these two slice counts as proxies off `ReproductionState`
 * (`POSTPARTUM_WAITING` for fresh, `NOT_ELIGIBLE` for growing — see `dashboard.service.ts`'s
 * `productionBreakdown` comment).
 *
 * RAKHAL-290: `growing` is really the `AnimalCategory.HEIFER` count (the label was just stale
 * i18n — fixed in `dashboard.herdStatus.production.growing` — same underlying data). Its
 * deep-link now uses the real `animalCategory` filter (`ListCattleQueryDto.animalCategory`,
 * RAKHAL-289) instead of the `reproductiveStatus=NOT_ELIGIBLE` proxy, which missed heifers with
 * no `ReproductionProfile` row at all. `fresh` has no equivalent real filter yet — no
 * `lactationStage` param exists on `ListCattleQueryDto` (checked `list-cattle-query.dto.ts`
 * directly) — so it's left on the `reproductiveStatus=POSTPARTUM_WAITING` proxy pending a
 * `lactationStage` filter ticket. */
const PRODUCTION_SLICE_HREF: Record<string, string> = {
  milking: "/cattle?productionStatus=MILKING",
  dry: "/cattle?productionStatus=DRY",
  fresh: "/cattle?reproductiveStatus=POSTPARTUM_WAITING",
  growing: "/cattle?animalCategory=HEIFER",
};

// Chart rendering is client/DOM-only and not needed for the initial paint — keep it out of the main bundle.
const HerdStatusChartInner = dynamic(() => import("./herd-status-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto size-[170px] rounded-full" />,
});

/** Matches the Figma "Livestock Count" card (732:1737) exactly: one donut, "Total" center label,
 * a legend row below. Figma's mock legend is Cows/Heifers/Bulls/Weiners/Calves (a sex/age split
 * this backend doesn't track) — used the real `productionBreakdown` categories instead (the
 * closest real "what state is the herd in" split `herd-status.ts` actually returns). */
export function HerdStatusDonut() {
  const t = useTranslations("dashboard.herdStatus");
  const query = useHerdStatus();

  if (query.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const data = query.data;
  if (!data) return null;

  const slices: (DonutSlice & { href?: string })[] = [
    { name: t("production.milking"), value: data.productionBreakdown.milking, color: "#065f46", href: PRODUCTION_SLICE_HREF.milking },
    { name: t("production.dry"), value: data.productionBreakdown.dry, color: "#047857", href: PRODUCTION_SLICE_HREF.dry },
    { name: t("production.fresh"), value: data.productionBreakdown.fresh, color: "#10b981", href: PRODUCTION_SLICE_HREF.fresh },
    { name: t("production.growing"), value: data.productionBreakdown.growing, color: "#6ee7b7", href: PRODUCTION_SLICE_HREF.growing },
    { name: t("calvesTotal"), value: data.calves.total, color: "#d1fae5", href: "/cattle?purpose=CALF" },
  ];

  return (
    <DashboardCard
      title={t("title")}
      headerRight={
        <Link href="/cattle" className="text-xs font-medium text-primary hover:underline">
          {t("viewAll")}
        </Link>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-between gap-6">
        <HerdStatusChartInner slices={slices} centerLabel={t("totalLabel")} centerValue={data.totalActive} />
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {slices.map((slice) => (
            <Link
              key={slice.name}
              href={slice.href ?? "/cattle"}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span aria-hidden className="h-1.5 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
              {slice.name}: <span className="font-medium text-foreground">{slice.value}</span>
            </Link>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

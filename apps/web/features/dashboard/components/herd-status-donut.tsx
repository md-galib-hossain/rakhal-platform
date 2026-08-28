"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ANIMAL_CATEGORY_SLICE_COLOR } from "@/features/cattle/utils/animal-category-style";
import { useHerdStatus } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";
import type { DonutSlice } from "./herd-status-chart-inner";

type CategoryKey = "calf" | "heifer" | "cow" | "bull" | "steer";
/** Cow-first display order (biggest/most-relevant category first) — the wire shape
 * (`categoryBreakdown`) has no inherent order since it's a plain object. */
const CATEGORY_ORDER: CategoryKey[] = ["cow", "heifer", "calf", "bull", "steer"];

/** Maps each `categoryBreakdown` key to the matching `cattle.animalCategory.*` i18n key (the
 * codebase's existing `AnimalCategory` enum casing) — reused verbatim rather than duplicating new
 * labels for the same 5 values (see `cattle-columns.tsx`'s `ANIMAL_CATEGORY_VARIANT`). */
const CATEGORY_I18N_KEY: Record<CategoryKey, "CALF" | "HEIFER" | "COW" | "BULL" | "STEER"> = {
  calf: "CALF",
  heifer: "HEIFER",
  cow: "COW",
  bull: "BULL",
  steer: "STEER",
};

/** Deep-links each of the 5 `categoryBreakdown` slices to the matching Cattle-page
 * `animalCategory` filter (`ListCattleQueryDto.animalCategory`, RAKHAL-289 — already wired into
 * `CattleFilters`/`CattleTable`). Real partition by construction, so no proxy filters needed
 * anymore (the old `productionBreakdown`-based donut had to fall back to `reproductiveStatus`/
 * `purpose` proxies for `fresh`/`growing`/calves — moot now, see `types.ts`'s `HerdStatusResponse`
 * doc comment). */
const CATEGORY_SLICE_HREF: Record<CategoryKey, string> = {
  calf: "/animals?animalCategory=CALF",
  heifer: "/animals?animalCategory=HEIFER",
  cow: "/animals?animalCategory=COW",
  bull: "/animals?animalCategory=BULL",
  steer: "/animals?animalCategory=STEER",
};

/** RAKHAL-402 — reuses the shared `ANIMAL_CATEGORY_SLICE_COLOR` (info/purple/primary/indigo/teal,
 * same convention `cattle-columns.tsx`'s `ANIMAL_CATEGORY_VARIANT` chips use) instead of a
 * per-file copy, remapped from lowercase `CategoryKey` to the real `AnimalCategory` values via
 * `CATEGORY_I18N_KEY` above. */
const CATEGORY_SLICE_COLOR: Record<CategoryKey, string> = {
  calf: ANIMAL_CATEGORY_SLICE_COLOR.CALF,
  heifer: ANIMAL_CATEGORY_SLICE_COLOR.HEIFER,
  cow: ANIMAL_CATEGORY_SLICE_COLOR.COW,
  bull: ANIMAL_CATEGORY_SLICE_COLOR.BULL,
  steer: ANIMAL_CATEGORY_SLICE_COLOR.STEER,
};

// Chart rendering is client/DOM-only and not needed for the initial paint — keep it out of the main bundle.
const HerdStatusChartInner = dynamic(() => import("./herd-status-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto size-[170px] rounded-full" />,
});

/** Matches the Figma "Livestock Count" card (732:1737) exactly: one donut, "Total" center label,
 * a legend row below. Figma's mock legend is Cows/Heifers/Bulls/Weiners/Calves — now the real
 * thing: `categoryBreakdown` is a genuine `AnimalCategory` partition (every active cow counted
 * exactly once), fixing the old donut's math bug where 4 independent overlapping
 * `productionBreakdown` dimensions were rendered as if they were mutually-exclusive pie slices
 * (confirmed: a 1-cow farm could show 3 non-zero "slices" for the same cow). Labels/colors reuse
 * `cattle-columns.tsx`'s `cattle.animalCategory.*` i18n + `ANIMAL_CATEGORY_VARIANT` chip-color
 * convention rather than inventing new ones for the same 5 values. */
export function HerdStatusDonut() {
  const t = useTranslations("dashboard.herdStatus");
  const tCategory = useTranslations("cattle.animalCategory");
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

  const slices: (DonutSlice & { href?: string })[] = CATEGORY_ORDER.map((key) => ({
    name: tCategory(CATEGORY_I18N_KEY[key]),
    value: data.categoryBreakdown[key],
    color: CATEGORY_SLICE_COLOR[key],
    href: CATEGORY_SLICE_HREF[key],
  }));

  return (
    <DashboardCard
      title={t("title")}
      headerRight={
        <Link href="/animals" className="text-xs font-medium text-primary hover:underline">
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
              href={slice.href ?? "/animals"}
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

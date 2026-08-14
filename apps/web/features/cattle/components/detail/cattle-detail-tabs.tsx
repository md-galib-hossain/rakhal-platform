"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useCalfDetail } from "@/features/calves/hooks/use-calves";
import { OverviewTab as CalfOverviewTab } from "@/features/calves/components/detail/overview-tab";
import { ColostrumTab } from "@/features/calves/components/detail/colostrum-tab";
import { MilkFeedingTab } from "@/features/calves/components/detail/milk-feeding-tab";
import { WeightTab as CalfWeightTab } from "@/features/calves/components/detail/weight-tab";
import { StarterFeedTab } from "@/features/calves/components/detail/starter-feed-tab";
import { TasksTab as CalfTasksTab } from "@/features/calves/components/detail/tasks-tab";
import { OverviewTab } from "./overview-tab";
import { ReproductionTab } from "./reproduction-tab";
import { HealthTab } from "./health-tab";
import { FinanceTab } from "./finance-tab";
import { PedigreeTab } from "./pedigree-tab";
import { FeedingTab } from "./feeding-tab";
import type { AnimalCategory, CattleGender, LactationStage } from "../../types";

const BASE_TABS = ["overview", "reproduction", "health", "finance", "pedigree", "feeding"] as const;
const CALF_TABS = ["colostrum", "milk", "weight", "starterFeed", "tasks"] as const;
type BaseTabKey = (typeof BASE_TABS)[number];
type CalfTabKey = (typeof CALF_TABS)[number];
type TabKey = BaseTabKey | CalfTabKey;

/** Segmented pill tab bar (Figma "Single Cow Details" frame 1042:57994, node 1042:58064) over the
 * base 5 detail tabs — muted track, active tab a raised white pill with a primary-green icon+label,
 * inactive tabs plain muted-grey. URL-synced (`?tab=`) so a tab is bookmarkable/shareable, same
 * `nuqs` pattern the cattle list's filters already use.
 *
 * **Calves merge (no ticket #):** for `animalCategory === "CALF"` rows, the single "Overview" tab
 * swaps its content to the calf module's own overview (`CalfOverviewTab`, `useCalfDetail(cattleId)`
 * — a calf IS this same `Cattle` row, just a second real backend resource, `GET /calves/:id`) and
 * the tab bar gains four more calf-rearing tabs (colostrum/milk/weight/starter-feed/tasks) reused
 * as-is from the former standalone Calves module (`features/calves/components/detail/*`) — no
 * second "Overview" tab. Non-calf animals never mount `useCalfDetail`. Each calf tab's own content
 * handles `calfQuery`'s loading/error state independently (same skeleton/`ErrorState` pattern the
 * base tabs' own per-tab fetches already use) so the tab bar itself never has to wait. */
export function CattleDetailTabs({
  cattleId,
  gender,
  lactationStage,
  animalCategory,
}: {
  cattleId: string;
  gender: CattleGender;
  /** RAKHAL-291-F — already computed server-side on `CattleDetail` (RAKHAL-273); threaded through
   * so the Reproduction tab's Lactation Summary card doesn't need a second fetch for it. */
  lactationStage?: LactationStage | null;
  animalCategory: AnimalCategory;
}) {
  const t = useTranslations("cattle.detail.tabs");
  const tCalf = useTranslations("calves.detail.tabs");
  const tCalfDetail = useTranslations("calves.detail");
  const isCalf = animalCategory === "CALF";
  const calfQuery = useCalfDetail(isCalf ? cattleId : undefined);
  const tabs: readonly TabKey[] = isCalf ? [...BASE_TABS, ...CALF_TABS] : BASE_TABS;
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("overview"));
  const active: TabKey = (tabs as readonly string[]).includes(tab) ? (tab as TabKey) : "overview";

  return (
    <Tabs value={active} onValueChange={(v) => void setTab(v)}>
      <TabsList className="h-auto w-full flex-wrap items-stretch justify-between gap-1 rounded-xl border border-border bg-muted p-1 text-muted-foreground">
        {tabs.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className={cn(
              "flex-1 gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-none",
              "data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm",
            )}
          >
            <Box className="size-[18px]" aria-hidden />
            {(CALF_TABS as readonly string[]).includes(key) ? tCalf(key as CalfTabKey) : t(key)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="overview">
        {isCalf ? (
          calfQuery.isLoading ? (
            <CardSkeleton lines={3} />
          ) : calfQuery.isError || !calfQuery.data ? (
            <ErrorState description={tCalfDetail("error")} onRetry={() => calfQuery.refetch()} />
          ) : (
            <CalfOverviewTab data={calfQuery.data} />
          )
        ) : (
          <OverviewTab cattleId={cattleId} />
        )}
      </TabsContent>
      <TabsContent value="reproduction">
        <ReproductionTab cattleId={cattleId} gender={gender} lactationStage={lactationStage} />
      </TabsContent>
      <TabsContent value="health">
        <HealthTab cattleId={cattleId} />
      </TabsContent>
      <TabsContent value="finance">
        <FinanceTab cattleId={cattleId} />
      </TabsContent>
      <TabsContent value="pedigree">
        <PedigreeTab cattleId={cattleId} />
      </TabsContent>
      <TabsContent value="feeding">
        <FeedingTab cattleId={cattleId} />
      </TabsContent>
      {isCalf ? (
        <>
          <TabsContent value="colostrum">
            {calfQuery.isLoading ? (
              <CardSkeleton lines={3} />
            ) : calfQuery.isError || !calfQuery.data ? (
              <ErrorState description={tCalfDetail("error")} onRetry={() => calfQuery.refetch()} />
            ) : (
              <ColostrumTab calfId={cattleId} data={calfQuery.data} />
            )}
          </TabsContent>
          <TabsContent value="milk">
            {calfQuery.isLoading ? (
              <CardSkeleton lines={3} />
            ) : calfQuery.isError || !calfQuery.data ? (
              <ErrorState description={tCalfDetail("error")} onRetry={() => calfQuery.refetch()} />
            ) : (
              <MilkFeedingTab calfId={cattleId} data={calfQuery.data} />
            )}
          </TabsContent>
          <TabsContent value="weight">
            {calfQuery.isLoading ? (
              <CardSkeleton lines={3} />
            ) : calfQuery.isError || !calfQuery.data ? (
              <ErrorState description={tCalfDetail("error")} onRetry={() => calfQuery.refetch()} />
            ) : (
              <CalfWeightTab calfId={cattleId} data={calfQuery.data} />
            )}
          </TabsContent>
          <TabsContent value="starterFeed">
            {calfQuery.isLoading ? (
              <CardSkeleton lines={3} />
            ) : calfQuery.isError || !calfQuery.data ? (
              <ErrorState description={tCalfDetail("error")} onRetry={() => calfQuery.refetch()} />
            ) : (
              <StarterFeedTab calfId={cattleId} data={calfQuery.data} />
            )}
          </TabsContent>
          <TabsContent value="tasks">
            {calfQuery.isLoading ? (
              <CardSkeleton lines={3} />
            ) : calfQuery.isError || !calfQuery.data ? (
              <ErrorState description={tCalfDetail("error")} onRetry={() => calfQuery.refetch()} />
            ) : (
              <CalfTasksTab data={calfQuery.data} />
            )}
          </TabsContent>
        </>
      ) : null}
    </Tabs>
  );
}

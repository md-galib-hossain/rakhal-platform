"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import {
  LayoutDashboard,
  TrendingUp,
  Utensils,
  HeartPulse,
  Stethoscope,
  Wallet,
  GitBranch,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./overview-tab";
import { PerformanceTab } from "./performance-tab";
import { FeedingTab } from "./feeding-tab";
import { ReproductionTab } from "./reproduction-tab";
import { HealthTab } from "./health-tab";
import { FinanceTab } from "./finance-tab";
import { PedigreeTab } from "./pedigree-tab";
import { TasksTab } from "./tasks-tab";
import type { AnimalCategory, CattleGender, LactationStage } from "../../types";

const TABS = ["overview", "performance", "feeding", "reproduction", "health", "finance", "pedigree", "tasks"] as const;
type TabKey = (typeof TABS)[number];

const TAB_ICONS: Record<TabKey, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  performance: TrendingUp,
  feeding: Utensils,
  reproduction: HeartPulse,
  health: Stethoscope,
  finance: Wallet,
  pedigree: GitBranch,
  tasks: ListChecks,
};

/**
 * Fixed 8-tab profile shell (unified animal-profile redesign, no ticket #, superseding the earlier
 * per-category variable-length tab list — see the plan doc for the full rationale). Every
 * `animalCategory` (Calf/Heifer/Cow/Bull/Steer) gets the **same** top-level tab set —
 * Overview/Performance/Feeding/Reproduction/Health/Finance/Ancestry("pedigree" key kept internally
 * to avoid an `?tab=` breaking change, label-only rename)/Tasks — so a farmer doesn't relearn the
 * profile layout as an animal ages from calf to cow. What changes is each tab's *content*, branched
 * internally by the individual tab component on `animalCategory` (`OverviewTab`/`PerformanceTab`/
 * `FeedingTab`/`ReproductionTab` each do this themselves now); `HealthTab`/`FinanceTab`/`PedigreeTab`
 * were already category-agnostic and are unchanged. `TasksTab` is the same live per-animal Task Hub
 * view for every category, including `CALF` (upgraded from the old read-only calf-only tasks list).
 * Segmented pill tab bar styling (Figma "Single Cow Details" frame 1042:57994, node 1042:58064)
 * unchanged from the previous version. URL-synced (`?tab=`) so a tab is bookmarkable/shareable.
 */
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
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("overview"));
  const active: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : "overview";

  return (
    <Tabs value={active} onValueChange={(v) => void setTab(v)}>
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1 text-muted-foreground sm:grid-cols-4">
        {TABS.map((key) => {
          const Icon = TAB_ICONS[key];
          return (
            <TabsTrigger
              key={key}
              value={key}
              className={cn(
                "gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-none",
                "data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {t(key)}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value="overview">
        <OverviewTab cattleId={cattleId} animalCategory={animalCategory} />
      </TabsContent>
      <TabsContent value="performance">
        <PerformanceTab cattleId={cattleId} gender={gender} lactationStage={lactationStage} animalCategory={animalCategory} />
      </TabsContent>
      <TabsContent value="feeding">
        <FeedingTab cattleId={cattleId} animalCategory={animalCategory} />
      </TabsContent>
      <TabsContent value="reproduction">
        <ReproductionTab cattleId={cattleId} gender={gender} animalCategory={animalCategory} />
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
      <TabsContent value="tasks">
        <TasksTab cattleId={cattleId} />
      </TabsContent>
    </Tabs>
  );
}

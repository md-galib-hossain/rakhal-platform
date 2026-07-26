"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./overview-tab";
import { ColostrumTab } from "./colostrum-tab";
import { MilkFeedingTab } from "./milk-feeding-tab";
import { WeightTab } from "./weight-tab";
import { StarterFeedTab } from "./starter-feed-tab";
import { TasksTab } from "./tasks-tab";
import type { CalfDetail } from "../../types";

const TABS = ["overview", "colostrum", "milk", "weight", "starterFeed", "tasks"] as const;
type TabKey = (typeof TABS)[number];

/** Segmented pill tab bar, URL-synced (`?tab=`) — same `Tabs` primitive + styling as
 * `CattleDetailTabs`. Each tab owns its own "open log dialog" state; the single `GET /calves/:id`
 * fetch already returned everything, so no tab re-fetches. */
export function CalfDetailTabs({ calfId, data }: { calfId: string; data: CalfDetail }) {
  const t = useTranslations("calves.detail.tabs");
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("overview"));
  const active: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : "overview";

  return (
    <Tabs value={active} onValueChange={(v) => void setTab(v)}>
      <TabsList className="h-12 w-full items-stretch justify-between gap-0 rounded-xl border border-border bg-muted p-1 text-muted-foreground">
        {TABS.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className="flex-1 gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            {t(key)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="overview">
        <OverviewTab data={data} />
      </TabsContent>
      <TabsContent value="colostrum">
        <ColostrumTab calfId={calfId} data={data} />
      </TabsContent>
      <TabsContent value="milk">
        <MilkFeedingTab calfId={calfId} data={data} />
      </TabsContent>
      <TabsContent value="weight">
        <WeightTab calfId={calfId} data={data} />
      </TabsContent>
      <TabsContent value="starterFeed">
        <StarterFeedTab calfId={calfId} data={data} />
      </TabsContent>
      <TabsContent value="tasks">
        <TasksTab data={data} />
      </TabsContent>
    </Tabs>
  );
}

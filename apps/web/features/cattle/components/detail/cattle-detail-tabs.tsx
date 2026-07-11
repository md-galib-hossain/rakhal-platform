"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./overview-tab";
import { ReproductionTab } from "./reproduction-tab";
import { HealthTab } from "./health-tab";
import { FinanceTab } from "./finance-tab";
import { PedigreeTab } from "./pedigree-tab";
import type { CattleGender } from "../../types";

const TABS = ["overview", "reproduction", "health", "finance", "pedigree"] as const;
type TabKey = (typeof TABS)[number];

/** Pill tab bar (Figma B1-S5) over the 5 detail tabs — URL-synced (`?tab=`) so a tab is
 * bookmarkable/shareable, same `nuqs` pattern the cattle list's filters already use. */
export function CattleDetailTabs({ cattleId, gender }: { cattleId: string; gender: CattleGender }) {
  const t = useTranslations("cattle.detail.tabs");
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("overview"));
  const active: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : "overview";

  return (
    <Tabs value={active} onValueChange={(v) => void setTab(v)}>
      <TabsList>
        {TABS.map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(key)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="overview">
        <OverviewTab cattleId={cattleId} />
      </TabsContent>
      <TabsContent value="reproduction">
        <ReproductionTab cattleId={cattleId} gender={gender} />
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
    </Tabs>
  );
}

"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./overview-tab";
import { ReproductionTab } from "./reproduction-tab";
import { HealthTab } from "./health-tab";
import { FinanceTab } from "./finance-tab";
import { PedigreeTab } from "./pedigree-tab";
import type { CattleGender } from "../../types";

const TABS = ["overview", "reproduction", "health", "finance", "pedigree"] as const;
type TabKey = (typeof TABS)[number];

/** Segmented pill tab bar (Figma "Single Cow Details" frame 1042:57994, node 1042:58064) over the
 * 5 detail tabs — muted track, active tab a raised white pill with a primary-green icon+label,
 * inactive tabs plain muted-grey. URL-synced (`?tab=`) so a tab is bookmarkable/shareable, same
 * `nuqs` pattern the cattle list's filters already use. */
export function CattleDetailTabs({ cattleId, gender }: { cattleId: string; gender: CattleGender }) {
  const t = useTranslations("cattle.detail.tabs");
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("overview"));
  const active: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : "overview";

  return (
    <Tabs value={active} onValueChange={(v) => void setTab(v)}>
      <TabsList className="h-12 w-full items-stretch justify-between gap-0 rounded-xl border border-border bg-muted p-1 text-muted-foreground">
        {TABS.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className={cn(
              "flex-1 gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-none",
              "data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm",
            )}
          >
            <Box className="size-[18px]" aria-hidden />
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

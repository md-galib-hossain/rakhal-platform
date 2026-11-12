"use client"; // URL-synced segment state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedItemView } from "./feed-item-view";
import { FeedStockView } from "./feed-stock-view";

const SEGMENTS = ["purchased", "prepared"] as const;
type FeedSegment = (typeof SEGMENTS)[number];

/**
 * Inventory's unified "Feed" tab (`feed_taxonomy_unification`) — feed is the umbrella term, so one
 * tab holds both views instead of the previous "Forage" and "Feed" tabs sitting side by side as if
 * unrelated: **Purchased** (this module's own `FeedItem` CRUD, formerly the "Forage" tab — forage,
 * concentrate, mineral, vitamin and additive stock a farm buys in) and **Prepared** (read-only
 * `FeedStock` batches produced by finalizing a Concentrate Mixer/TMR on the Feed Formulator page,
 * formerly the standalone "Feed" tab). `?segment=` URL-synced so a deep link is bookmarkable, same
 * pattern as `InventoryTabs`' own `?tab=`.
 */
export function FeedView({ view }: { view: "table" | "grid" }) {
  const t = useTranslations("inventory.feed.segment");
  const [segment, setSegment] = useQueryState(
    "segment",
    parseAsStringEnum<FeedSegment>([...SEGMENTS]).withDefault("purchased"),
  );

  return (
    <Tabs value={segment} onValueChange={(v) => void setSegment(v as FeedSegment)}>
      <TabsList>
        <TabsTrigger value="purchased">{t("purchased")}</TabsTrigger>
        <TabsTrigger value="prepared">{t("prepared")}</TabsTrigger>
      </TabsList>
      <TabsContent value="purchased">
        <FeedItemView view={view} />
      </TabsContent>
      <TabsContent value="prepared">
        <FeedStockView view={view} />
      </TabsContent>
    </Tabs>
  );
}

"use client"; // URL-synced filters via the shared FilterBar

import { useTranslations } from "next-intl";
import { FilterBar } from "@/components/shared/filter-bar";

const CLASSES = ["FORAGE", "CONCENTRATE", "MINERAL", "VITAMIN", "ADDITIVE", "OTHER"] as const;

/** Search + class select — mirrors `MedicineFilters`' anatomy (same `layout="split"` row Figma's
 * "Inventory" frame uses for every tab: search far left, Filter+"Add X" far right). A feed item has
 * no `category` enum to filter by (it's free text on the backend), so only `feedClass` gets a
 * select, unlike Medicine's category+status pair. */
export function FeedItemFilters({ actions }: { actions?: React.ReactNode }) {
  const t = useTranslations("inventory.feed.filters");

  return (
    <FilterBar
      layout="split"
      searchKey="search"
      searchPlaceholder={t("searchPlaceholder")}
      selects={[
        {
          key: "feedClass",
          label: t("class"),
          options: CLASSES.map((feedClass) => ({ value: feedClass, label: t(`classOptions.${feedClass}`) })),
        },
      ]}
      extra={actions}
    />
  );
}

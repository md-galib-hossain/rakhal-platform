"use client"; // URL-synced filters via the shared FilterBar

import { useTranslations } from "next-intl";
import { FilterBar } from "@/components/shared/filter-bar";

const TYPES = ["ROUGHAGE", "CONCENTRATE", "SILAGE", "SUPPLEMENT", "BY_PRODUCT", "MINERAL", "OTHER"] as const;

/** Search + type select — mirrors `MedicineFilters`' anatomy (same `layout="split"` row Figma's
 * "Inventory" frame uses for every tab: search far left, Filter+"Add X" far right). Forage has no
 * `category` enum to filter by (it's free text on the backend), so only `type` gets a select,
 * unlike Medicine's category+status pair. */
export function ForageFilters({ actions }: { actions?: React.ReactNode }) {
  const t = useTranslations("inventory.forage.filters");

  return (
    <FilterBar
      layout="split"
      searchKey="search"
      searchPlaceholder={t("searchPlaceholder")}
      selects={[
        {
          key: "type",
          label: t("type"),
          options: TYPES.map((type) => ({ value: type, label: t(`typeOptions.${type}`) })),
        },
      ]}
      extra={actions}
    />
  );
}

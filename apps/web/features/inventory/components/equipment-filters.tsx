"use client"; // URL-synced filters via the shared FilterBar

import { useTranslations } from "next-intl";
import { FilterBar } from "@/components/shared/filter-bar";

const TYPES = ["EQUIPMENT", "MACHINERY", "TOOL", "SUPPLY", "OTHER"] as const;

/** Search + type select (mirrors `MedicineFilters`' anatomy) — URL-synced via the shared
 * `FilterBar`, read back by the equipment list query. Figma's "Inventory" row splits search to the
 * far left from Filter+"Add Item" on the far right, same `layout="split"` as Medicine/Forage. */
export function EquipmentFilters({ actions }: { actions?: React.ReactNode }) {
  const t = useTranslations("inventory.equipment.filters");

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

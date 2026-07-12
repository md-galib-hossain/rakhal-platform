"use client"; // URL-synced filters via the shared FilterBar

import { useTranslations } from "next-intl";
import { FilterBar } from "@/components/shared/filter-bar";

const CATEGORIES = [
  "ANTIBIOTIC",
  "ANTIPARASITIC",
  "VACCINE",
  "VITAMIN",
  "MINERAL",
  "HORMONE",
  "ANTI_INFLAMMATORY",
  "ANALGESIC",
  "OTHER",
] as const;

/** Search + category/expiry-status selects (mirrors `CattleFilters`' anatomy) — URL-synced via the
 * shared `FilterBar`, read back by the medicine list query. `actions` (the "Add Medicine" button)
 * renders after the filters, matching the Figma row where search/filter/add sit together. */
export function MedicineFilters({ actions }: { actions?: React.ReactNode }) {
  const t = useTranslations("inventory.medicine.filters");

  return (
    <FilterBar
      searchKey="search"
      searchPlaceholder={t("searchPlaceholder")}
      selects={[
        {
          key: "category",
          label: t("category"),
          options: CATEGORIES.map((c) => ({ value: c, label: t(`categoryOptions.${c}`) })),
        },
        {
          key: "status",
          label: t("status"),
          options: [
            { value: "active", label: t("statusOptions.active") },
            { value: "expiring_soon", label: t("statusOptions.expiring_soon") },
            { value: "expired", label: t("statusOptions.expired") },
          ],
        },
      ]}
      extra={actions}
    />
  );
}

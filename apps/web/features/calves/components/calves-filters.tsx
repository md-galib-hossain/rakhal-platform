"use client"; // URL-synced filters via the shared FilterBar

import { useTranslations } from "next-intl";
import { FilterBar } from "@/components/shared/filter-bar";

/** Search + stage/health selects (RFE-033, PRD §14, API §10) — URL-synced via the shared
 * `FilterBar`, read back by `CalvesTable` for the actual query. No breed/shed/feed-group filters
 * exist for calves (not in the backend's `ListCalfQueryDto`). */
export function CalvesFilters({ actions }: { actions?: React.ReactNode }) {
  const t = useTranslations("calves.filters");

  return (
    <FilterBar
      searchKey="search"
      searchPlaceholder={t("searchPlaceholder")}
      selects={[
        {
          key: "stage",
          label: t("stage"),
          options: [
            { value: "newborn", label: t("stageOptions.newborn") },
            { value: "young", label: t("stageOptions.young") },
            { value: "pre_weaning", label: t("stageOptions.preWeaning") },
            { value: "post_weaning", label: t("stageOptions.postWeaning") },
          ],
        },
        {
          key: "healthStatus",
          label: t("health"),
          options: [
            { value: "healthy", label: t("healthOptions.healthy") },
            { value: "concern", label: t("healthOptions.concern") },
          ],
        },
      ]}
      extra={actions}
    />
  );
}

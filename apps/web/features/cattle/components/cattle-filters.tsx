"use client"; // URL-synced filters via the shared FilterBar

import { useTranslations } from "next-intl";
import { FilterBar } from "@/components/shared/filter-bar";
import { useBreeds, useFeedGroups, useSheds } from "../hooks/use-cattle";

/** Search + status/breed/shed/feed-group/health selects (PRD §8.1 list filters, ticket RFE-021) —
 * all URL-synced via the shared `FilterBar`, read back by `CattleTable` for the actual query. */
export function CattleFilters() {
  const t = useTranslations("cattle.filters");
  const breeds = useBreeds();
  const sheds = useSheds();
  const feedGroups = useFeedGroups();

  return (
    <FilterBar
      searchKey="search"
      searchPlaceholder={t("searchPlaceholder")}
      selects={[
        {
          key: "productionStatus",
          label: t("status"),
          options: [
            { value: "MILKING", label: t("statusOptions.milking") },
            { value: "DRY", label: t("statusOptions.dry") },
            { value: "FRESH", label: t("statusOptions.fresh") },
            { value: "GROWING", label: t("statusOptions.growing") },
            { value: "SOLD", label: t("statusOptions.sold") },
            { value: "DECEASED", label: t("statusOptions.deceased") },
          ],
        },
        {
          key: "healthStatus",
          label: t("health"),
          options: [
            { value: "HEALTHY", label: t("healthOptions.healthy") },
            { value: "SICK", label: t("healthOptions.sick") },
            { value: "IN_TREATMENT", label: t("healthOptions.inTreatment") },
            { value: "WITHHOLDING", label: t("healthOptions.withholding") },
          ],
        },
        {
          key: "breedId",
          label: t("breed"),
          options: (breeds.data?.items ?? []).map((b) => ({ value: b.id, label: b.name })),
        },
        {
          key: "shedId",
          label: t("shed"),
          options: (sheds.data?.items ?? []).map((s) => ({ value: s.id, label: s.name })),
        },
        {
          key: "feedGroupId",
          label: t("feedGroup"),
          options: (feedGroups.data ?? []).map((g) => ({ value: g.id, label: g.name })),
        },
      ]}
    />
  );
}

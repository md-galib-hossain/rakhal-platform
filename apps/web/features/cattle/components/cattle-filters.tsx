"use client"; // URL-synced filters via the shared FilterBar

import { useTranslations } from "next-intl";
import { FilterBar } from "@/components/shared/filter-bar";
import { useAnimalGroups, useBreeds, useSheds } from "../hooks/use-cattle";

/** Search + category/status/breed/shed/animal-group/health selects (PRD §8.1 list filters, ticket
 * RFE-021) — all URL-synced via the shared `FilterBar`, read back by `CattleTable` for the actual
 * query. `actions` (the "Add New Cow" button) renders after the filters, matching the Figma "All
 * Cattle View" row where search/filter/add all sit together, right-aligned next to the section
 * title.
 *
 * The `animalCategory` select folds the former standalone Calves page in as a filter (Calves are
 * just `animalCategory: "CALF"` rows) — same URL param the category-highlight tiles already
 * read/write, so this dropdown and the tiles stay in sync in either direction. Calves' own
 * age-bucket "Stage" filter isn't exposed here — it has no equivalent on `GET /cattle`
 * (`ListCattleQueryDto` has no stage param, only the calf module's own `GET /calves` does), so
 * adding it would be a dead control; the calf KPI cards (below, on the page) already surface
 * weaning/feeding timing without it. */
export function CattleFilters({ actions }: { actions?: React.ReactNode }) {
  const t = useTranslations("cattle.filters");
  // RAKHAL-402 — shares `cattle.animalCategory` with the Chip labels (`cattle-columns.tsx` etc)
  // instead of the old separate `cattle.categories.{calf,heifer,cow,bull,steer}` set, so a
  // relabel can't silently drift between the filter dropdown and the rest of the app.
  const tCategories = useTranslations("cattle.animalCategory");
  const breeds = useBreeds();
  const sheds = useSheds();
  const animalGroups = useAnimalGroups();

  return (
    <FilterBar
      searchKey="search"
      searchPlaceholder={t("searchPlaceholder")}
      selects={[
        {
          key: "animalCategory",
          label: t("animalCategory"),
          options: [
            { value: "CALF", label: tCategories("CALF") },
            { value: "HEIFER", label: tCategories("HEIFER") },
            { value: "COW", label: tCategories("COW") },
            { value: "BULL", label: tCategories("BULL") },
            { value: "STEER", label: tCategories("STEER") },
          ],
        },
        {
          key: "productionStatus",
          label: t("status"),
          options: [
            { value: "MILKING", label: t("statusOptions.milking") },
            { value: "DRY", label: t("statusOptions.dry") },
          ],
        },
        {
          // RAKHAL-402 — herd status filter (`ListCattleQueryDto.status`). URL key `herdStatus`
          // rather than `status` to avoid clashing with the shared `FilterBar`'s existing
          // `productionStatus`-labeled "Status" select above, which this dropdown sits next to.
          key: "herdStatus",
          label: t("herdStatus"),
          options: [
            { value: "ACTIVE", label: t("herdStatusOptions.active") },
            { value: "SOLD", label: t("herdStatusOptions.sold") },
            { value: "CULLED", label: t("herdStatusOptions.culled") },
            { value: "DECEASED", label: t("herdStatusOptions.deceased") },
          ],
        },
        {
          // RAKHAL-402 — lifecycle sub-stage filter (`ListCattleQueryDto.lifecycleSubStage`),
          // nested under `animalCategory` (HEIFER/BULL only per `LifecycleSubStage`'s own doc
          // comment) — sits next to the category select it refines.
          key: "lifecycleSubStage",
          label: t("lifecycleSubStage"),
          options: [
            { value: "WEANED_HEIFER", label: t("lifecycleSubStageOptions.weanedHeifer") },
            { value: "GROWING_HEIFER", label: t("lifecycleSubStageOptions.growingHeifer") },
            { value: "BREEDING_HEIFER", label: t("lifecycleSubStageOptions.breedingHeifer") },
            { value: "WEANER_BULL", label: t("lifecycleSubStageOptions.weanerBull") },
            { value: "GROWING_BULL", label: t("lifecycleSubStageOptions.growingBull") },
            { value: "MATURE_BULL", label: t("lifecycleSubStageOptions.matureBull") },
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
          key: "animalGroupId",
          label: t("animalGroup"),
          options: (animalGroups.data?.items ?? []).map((g) => ({ value: g.id, label: g.name })),
        },
      ]}
      extra={actions}
    />
  );
}

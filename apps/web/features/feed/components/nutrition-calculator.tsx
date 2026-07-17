"use client"; // target-type pill + cattle/group selection + live requirements query

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Calculator } from "lucide-react";
import { useCattleOrGroupRequirements, useFeedGroups } from "../hooks/use-feed";
import { RequirementTile } from "./requirement-tile";

const targetTypes = ["GROUP", "INDIVIDUAL"] as const;
type TargetType = (typeof targetTypes)[number];

/** Standalone per-cow/per-group nutrition calculator (user request 2026-07-18 — "another portion
 * user can calculate for each of his cow how much nutritions is required"). Previously this cattle-
 * driven calculation (`GET /feed/requirements?cattleId=`/`?feedGroupId=`, already built end-to-end
 * on the backend — `FeedRequirementsService.calcForCattle`/`calcForFeedGroup`) only ever showed up
 * embedded in Step 1 of the create-mixture wizard, keyed off manually-typed weight/milk instead of
 * real records; a farmer had no way to check a cow's requirement without starting to build a ration.
 * This is a read-only lookup — it doesn't create anything.
 *
 * A group's response has no single `requirements` key (`per_cow`/`group_total` instead — see
 * `types.ts`'s `FeedRequirementsResult` doc comment), so this renders both figures for a group but
 * only the flat one for an individual cow. `data_source` (`cattle_record`/`milk_log_7d_avg`/`manual`/
 * `assumed_zero`) is surfaced next to each input so the farmer can tell a real figure from a guess.
 */
export function NutritionCalculator() {
  const t = useTranslations("feed.calculator");
  const feedGroups = useFeedGroups();
  const [targetType, setTargetType] = useState<TargetType>("INDIVIDUAL");
  const [cattleId, setCattleId] = useState<string | undefined>(undefined);
  const [feedGroupId, setFeedGroupId] = useState<string | undefined>(undefined);

  const result = useCattleOrGroupRequirements({ cattleId, feedGroupId });
  const r = result.data;

  const dataSourceLabel = useMemo(() => {
    if (!r?.data_source) return null;
    const key = (source: string) => `dataSource.${source}`;
    return {
      weight: t(key(r.data_source.weight)),
      milk: t(key(r.data_source.milk_yield)),
    };
  }, [r, t]);

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-card p-4 shadow-card">
      <p className="text-xl font-medium text-foreground">{t("title")}</p>

      <div className="flex h-12 max-w-md gap-1 rounded-xl border border-border bg-muted p-1">
        {targetTypes.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTargetType(value);
              setCattleId(undefined);
              setFeedGroupId(undefined);
            }}
            className={cn(
              "flex flex-1 items-center justify-center rounded-lg text-sm font-bold transition-colors",
              targetType === value ? "bg-card text-primary shadow-xs" : "text-muted-foreground",
            )}
          >
            {t(`targetType.${value}`)}
          </button>
        ))}
      </div>

      <div className="max-w-md">
        {targetType === "GROUP" ? (
          <Select value={feedGroupId} onValueChange={setFeedGroupId}>
            <LabeledSelectTrigger label={t("selectGroup")} placeholder={t("selectGroupPlaceholder")} className="h-11" />
            <SelectContent>
              {(feedGroups.data ?? []).map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} ({t("cowCount", { count: group.assigned_count })})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">{t("selectAnimal")}</p>
            <CattlePicker value={cattleId} onValueChange={(id) => setCattleId(id)} />
          </div>
        )}
      </div>

      {!cattleId && !feedGroupId ? (
        <EmptyState icon={Calculator} title={t("emptyState")} />
      ) : result.isLoading ? (
        <CardSkeleton lines={4} />
      ) : result.isError ? (
        <p className="text-sm text-destructive">{t("genericError")}</p>
      ) : r ? (
        <div className="flex flex-col gap-4">
          {dataSourceLabel ? (
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <p>
                {t("dataSourceWeight")}: <span className="font-medium text-foreground">{dataSourceLabel.weight}</span>
              </p>
              <p>
                {t("dataSourceMilk")}: <span className="font-medium text-foreground">{dataSourceLabel.milk}</span>
              </p>
            </div>
          ) : null}

          {r.requirements ? (
            <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-5">
              <RequirementTile label={t("dm")} value={r.requirements.dm_kg} unit={t("kgPerDay")} tone="foreground" />
              <RequirementTile label={t("protein")} value={r.requirements.cp_kg} unit={t("kgPerDay")} tone="info" />
              <RequirementTile label={t("energy")} value={r.requirements.me_mj} unit={t("mjPerDay")} tone="warning" />
              <RequirementTile label={t("fiber")} value={r.requirements.ndf_kg} unit={t("kgPerDay")} tone="success" />
              <RequirementTile label={t("fat")} value={r.requirements.fat_kg} unit={t("kgPerDay")} tone="foreground" />
            </div>
          ) : null}

          {r.per_cow ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">{t("perCow")}</p>
              <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-5">
                <RequirementTile label={t("dm")} value={r.per_cow.dm_kg} unit={t("kgPerDay")} tone="foreground" />
                <RequirementTile label={t("protein")} value={r.per_cow.cp_kg} unit={t("kgPerDay")} tone="info" />
                <RequirementTile label={t("energy")} value={r.per_cow.me_mj} unit={t("mjPerDay")} tone="warning" />
                <RequirementTile label={t("fiber")} value={r.per_cow.ndf_kg} unit={t("kgPerDay")} tone="success" />
                <RequirementTile label={t("fat")} value={r.per_cow.fat_kg} unit={t("kgPerDay")} tone="foreground" />
              </div>
            </div>
          ) : null}

          {r.group_total ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                {t("groupTotal", { count: r.inputs.headcount ?? 0 })}
              </p>
              <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-5">
                <RequirementTile label={t("dm")} value={r.group_total.dm_kg} unit={t("kgPerDay")} tone="foreground" />
                <RequirementTile label={t("protein")} value={r.group_total.cp_kg} unit={t("kgPerDay")} tone="info" />
                <RequirementTile label={t("energy")} value={r.group_total.me_mj} unit={t("mjPerDay")} tone="warning" />
                <RequirementTile label={t("fiber")} value={r.group_total.ndf_kg} unit={t("kgPerDay")} tone="success" />
                <RequirementTile label={t("fat")} value={r.group_total.fat_kg} unit={t("kgPerDay")} tone="foreground" />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

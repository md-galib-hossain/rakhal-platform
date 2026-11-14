"use client"; // mode switch + manual inputs

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleHelp, Scale } from "lucide-react";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { Input } from "@rakhal/ui/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rakhal/ui/ui/select";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { useAnimalGroup, useAnimalGroups, useCattlePagedList } from "@/features/cattle/hooks/use-cattle";
import { useRequirements } from "../hooks/use-feed";
import type { FeedRequirements } from "../types";
import { RequirementBreakdown } from "./requirement-breakdown";
import { RequirementSettingsSheet } from "./requirement-settings-sheet";

type Mode = "cow" | "group" | "manual";

/**
 * Cow requirements as a first-class screen (RFE-103, absorbing RAKHAL-267).
 *
 * Supports single cow, animal group, or manual entry.
 */
export function RequirementsTab() {
  const t = useTranslations("feed.requirements");
  const [mode, setMode] = useState<Mode>("cow");

  const [cattleId, setCattleId] = useState<string>("");
  const [groupId, setGroupId] = useState<string>("");
  const [manual, setManual] = useState({
    weightKg: "450",
    milkTargetL: "15",
    milkFatPct: "4",
    dim: "",
    gestationDays: "",
    bcs: "",
    animalType: "COW" as "COW" | "HEIFER" | "DRY",
  });

  const cattle = useCattlePagedList({});
  const groups = useAnimalGroups();
  const selectedGroup = (groups.data?.items ?? []).find((g) => g.id === groupId);
  const groupCattleQuery = useCattlePagedList(groupId ? { animalGroupId: groupId } : {});
  const groupCattle = groupCattleQuery.items;
  const groupFirstCowId = groupCattle[0]?.id;
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const params =
    mode === "cow"
      ? { cattleId: cattleId || undefined }
      : mode === "group"
        ? { cattleId: groupFirstCowId || undefined }
        : {
            weightKg: num(manual.weightKg),
            milkTargetL: num(manual.milkTargetL),
            milkFatPct: num(manual.milkFatPct),
            dim: num(manual.dim),
            gestationDays: num(manual.gestationDays),
            bcs: num(manual.bcs),
            animalType: manual.animalType,
          };

  const requirements = useRequirements(params);
  const data = requirements.data;
  const perCow = data?.requirements;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-lg font-medium text-foreground">{t("title")}</p>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
          {/* RFE-104: tuning sits beside the numbers it changes, so the effect is visible. */}
          <RequirementSettingsSheet />
        </div>

        <div className="flex flex-wrap gap-2">
          {(["cow", "group", "manual"] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "primary" : "secondary"}
              onClick={() => setMode(m)}
            >
              {t(`mode.${m}`)}
            </Button>
          ))}
        </div>

        {mode === "cow" ? (
          <div className="flex flex-col gap-1.5">
            <FieldLabel label={t("cowLabel")} hint={t("cowHint")} />
            <Select value={cattleId} onValueChange={setCattleId}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder={t("cowPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {cattle.items.map((cow) => (
                  <SelectItem key={cow.id} value={cow.id}>
                    {cow.name ?? cow.tagNumber} · {cow.tagNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : mode === "group" ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <FieldLabel label={t("groupLabel")} hint={t("groupHint")} />
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder={t("groupPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(groups.data?.items ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {groupId && (
              <div className="text-xs text-muted-foreground">
                {groupCattle.length > 0
                  ? t("groupMembers", { count: groupCattle.length })
                  : t("groupEmpty")}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ManualField
              label={t("weightLabel")}
              hint={t("weightHint")}
              value={manual.weightKg}
              onChange={(v) => setManual((s) => ({ ...s, weightKg: v }))}
            />
            <ManualField
              label={t("milkLabel")}
              hint={t("milkHint")}
              value={manual.milkTargetL}
              onChange={(v) => setManual((s) => ({ ...s, milkTargetL: v }))}
            />
            <ManualField
              label={t("fatLabel")}
              hint={t("fatHint")}
              value={manual.milkFatPct}
              onChange={(v) => setManual((s) => ({ ...s, milkFatPct: v }))}
            />
            <ManualField
              label={t("dimLabel")}
              hint={t("dimHint")}
              value={manual.dim}
              onChange={(v) => setManual((s) => ({ ...s, dim: v }))}
            />
            <ManualField
              label={t("gestationLabel")}
              hint={t("gestationHint")}
              value={manual.gestationDays}
              onChange={(v) => setManual((s) => ({ ...s, gestationDays: v }))}
            />
            <ManualField
              label={t("bcsLabel")}
              hint={t("bcsHint")}
              value={manual.bcs}
              onChange={(v) => setManual((s) => ({ ...s, bcs: v }))}
            />
            <div className="flex flex-col gap-1.5">
              <FieldLabel label={t("animalTypeLabel")} hint={t("animalTypeHint")} />
              <Select
                value={manual.animalType}
                onValueChange={(v) =>
                  setManual((s) => ({ ...s, animalType: v as "COW" | "HEIFER" | "DRY" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COW">{t("animalCow")}</SelectItem>
                  <SelectItem value="HEIFER">{t("animalHeifer")}</SelectItem>
                  <SelectItem value="DRY">{t("animalDry")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {data?.data_source ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{t("sourceWeight")}: {data.data_source.weight}</Badge>
            <Badge variant="outline">{t("sourceMilk")}: {data.data_source.milk_yield}</Badge>
            {data.data_source.milk_yield === "assumed_zero" ? (
              <Badge variant="secondary">{t("assumedZeroWarning")}</Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      {requirements.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : requirements.isError ? (
        <ErrorState onRetry={() => void requirements.refetch()} />
      ) : !perCow ? (
        <EmptyState icon={Scale} title={t("empty")} description={t("emptyDescription")} />
      ) : (
        <>
          <RequirementGrid title={t("perDay")} requirements={perCow} />
          {perCow.breakdown ? <RequirementBreakdown breakdown={perCow.breakdown} /> : null}
        </>
      )}
    </div>
  );
}

/** All 16 outputs — the wizard only ever showed the first five. */
function RequirementGrid({
  title,
  requirements: r,
}: {
  title: string;
  requirements: FeedRequirements;
}) {
  const t = useTranslations("feed.requirements");

  const tiles: Array<{ label: string; value: number | null; unit: string }> = [
    { label: t("dm"), value: r.dm_kg, unit: "kg" },
    { label: t("cp"), value: r.cp_kg, unit: "kg" },
    { label: t("me"), value: r.me_mj, unit: "MJ" },
    { label: t("ne"), value: r.ne_mcal, unit: "Mcal" },
    { label: t("energyDensity"), value: r.energy_density_mj_per_kg_dm, unit: "MJ/kg DM" },
    { label: t("cpPctOfDm"), value: r.cp_pct_of_dm, unit: "% DM" },
    { label: t("tdn"), value: r.tdn_kg, unit: "kg" },
    { label: t("ndfMin"), value: r.ndf_kg, unit: "kg" },
    { label: t("ndfMax"), value: r.ndf_max_kg, unit: "kg" },
    { label: t("adf"), value: r.adf_kg, unit: "kg" },
    { label: t("fat"), value: r.fat_kg, unit: "kg" },
    { label: t("calcium"), value: r.calcium_kg, unit: "kg" },
    { label: t("phosphorus"), value: r.phosphorus_kg, unit: "kg" },
    { label: t("caP"), value: r.ca_p_ratio_target, unit: ": 1" },
    { label: t("rdp"), value: r.rdp_pct, unit: "% CP" },
    { label: t("rup"), value: r.rup_pct, unit: "% CP" },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 rounded-xl border border-border p-3">
            <span className="text-xs font-bold text-muted-foreground">{tile.label}</span>
            <p className="text-lg font-semibold text-foreground">
              {tile.value == null ? "—" : tile.value.toFixed(2)}{" "}
              <span className="text-xs font-normal text-muted-foreground">{tile.value == null ? "" : tile.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Label with a "?" popover carrying a practical default (RAKHAL-267's AC). */
function FieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={label} className="text-muted-foreground">
            <CircleHelp className="size-3.5" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-w-64 text-xs">{hint}</PopoverContent>
      </Popover>
    </div>
  );
}

function ManualField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel label={label} hint={hint} />
      <Input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

"use client"; // selection state + three filtered queries

import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { cattleApi } from "@/features/cattle/api";
import type { CattleListItem } from "@/features/cattle/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { CreatableSelect } from "@/components/shared/creatable-select";
import { useCreateShedInline } from "@/features/cattle/hooks/use-cattle";

/** Most animals one bulk report covers — the backend's cap (`BULK_REPORT_MAX_ANIMALS`, RAKHAL-469). */
export const MAX_REPORT_ANIMALS = 100;

export interface PickedAnimal {
  id: string;
  tagNumber: string;
  name: string | null;
}

type Method = "shed" | "group" | "search";
const METHODS: Method[] = ["shed", "group", "search"];

const toPicked = (animal: CattleListItem): PickedAnimal => ({ id: animal.id, tagNumber: animal.tagNumber, name: animal.name });

/**
 * Pick several animals — by shed, by group, or by search — with a "select all" for what is listed (RFE-139, the
 * Report Sickness "Several animals" mode). Unlike the Apply-protocol and Quick Treat lists, which only show the first
 * page (20), this asks for up to 100 and says so when more exist, because an outbreak report that silently stops at
 * 20 of a 35-cow shed is worse than no shortcut. The selection is a `Map` so the parent can show tags afterwards
 * without another fetch, and it survives switching the pick method (a shed plus a few strays is one report).
 */
export function AnimalMultiPicker({
  selected,
  onChange,
  disabled,
  defaultMethod = "shed",
}: {
  selected: Map<string, PickedAnimal>;
  onChange: (next: Map<string, PickedAnimal>) => void;
  disabled?: boolean;
  /** Which pick method opens first. Report Sickness uses `search`: most reports are one cow, found by tag. */
  defaultMethod?: Method;
}) {
  const t = useTranslations("health.reportSickness.bulk.picker");
  const tCattle = useTranslations("cattle.form");
  const createShed = useCreateShedInline();
  const [method, setMethod] = useState<Method>(defaultMethod);
  const [shedId, setShedId] = useState<string | undefined>(undefined);
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const sheds = useQuery({ queryKey: ["cattle", "sheds"], queryFn: () => cattleApi.sheds(), staleTime: 60_000 });
  const groups = useQuery({ queryKey: ["cattle", "animal-groups"], queryFn: () => cattleApi.animalGroups(), staleTime: 60_000 });
  const enabled = method === "search" ? true : method === "shed" ? Boolean(shedId) : Boolean(groupId);
  const animals = useQuery({
    queryKey: ["cattle", "list", "bulk-report", method, shedId, groupId, deferredSearch],
    queryFn: () =>
      cattleApi.list(
        {
          shedId: method === "shed" ? shedId : undefined,
          animalGroupId: method === "group" ? groupId : undefined,
          search: method === "search" ? deferredSearch || undefined : undefined,
        },
        undefined,
        MAX_REPORT_ANIMALS,
      ),
    enabled,
    staleTime: 30_000,
  });
  const listed = animals.data?.items ?? [];
  const truncated = Boolean(animals.data?.meta.hasNextPage);
  const atCap = selected.size >= MAX_REPORT_ANIMALS;
  const allListedSelected = listed.length > 0 && listed.every((a) => selected.has(a.id));

  function toggle(animal: CattleListItem) {
    const next = new Map(selected);
    if (next.has(animal.id)) next.delete(animal.id);
    else if (!atCap) next.set(animal.id, toPicked(animal));
    onChange(next);
  }

  function selectAllListed() {
    const next = new Map(selected);
    for (const animal of listed) {
      if (next.size >= MAX_REPORT_ANIMALS) break;
      next.set(animal.id, toPicked(animal));
    }
    onChange(next);
  }

  function unselectListed() {
    const next = new Map(selected);
    for (const animal of listed) next.delete(animal.id);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={t("methodLabel")} className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={method === m}
            disabled={disabled}
            onClick={() => setMethod(m)}
            className={cn(
              "min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors",
              method === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30",
            )}
          >
            {t(`method.${m}`)}
          </button>
        ))}
      </div>

      {method === "shed" ? (
        <CreatableSelect
          value={shedId}
          onValueChange={setShedId}
          options={sheds.data?.items ?? []}
          trigger={
            <SelectTrigger aria-label={t("selectShed")}>
              <SelectValue placeholder={t("selectShedPlaceholder")} />
            </SelectTrigger>
          }
          createLabel={tCattle("addShed")}
          namePlaceholder={tCattle("shedNamePlaceholder")}
          createErrorMessage={tCattle("addShedError")}
          onCreate={(name) => createShed.mutateAsync(name)}
          disabled={disabled}
        />
      ) : method === "group" ? (
        <Select value={groupId} onValueChange={setGroupId} disabled={disabled}>
          <SelectTrigger aria-label={t("selectGroup")}>
            <SelectValue placeholder={t("selectGroupPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {(groups.data?.items ?? []).map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} disabled={disabled} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium text-foreground">{t("selectedCount", { count: selected.size })}</Label>
        <div className="flex items-center gap-2">
          {listed.length > 0 ? (
            <Button type="button" variant="outline" size="sm" disabled={disabled || (!allListedSelected && atCap)} onClick={allListedSelected ? unselectListed : selectAllListed}>
              {allListedSelected ? t("unselectListed") : t("selectAll", { count: listed.length })}
            </Button>
          ) : null}
          {selected.size > 0 ? (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(new Map())}>
              {t("clear")}
            </Button>
          ) : null}
        </div>
      </div>

      {atCap ? <p className="text-xs text-warning">{t("maxReached", { max: MAX_REPORT_ANIMALS })}</p> : null}

      <div className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
        {!enabled ? (
          <p className="p-4 text-center text-sm text-muted-foreground">{method === "shed" ? t("pickShedFirst") : t("pickGroupFirst")}</p>
        ) : animals.isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        ) : animals.isError ? (
          <p className="p-4 text-center text-sm text-destructive">{t("error")}</p>
        ) : listed.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">{t("noAnimals")}</p>
        ) : (
          listed.map((animal) => {
            const checked = selected.has(animal.id);
            return (
              <label key={animal.id} htmlFor={`bulk-animal-${animal.id}`} className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2", checked && "bg-primary/5")}>
                <Checkbox id={`bulk-animal-${animal.id}`} checked={checked} disabled={disabled || (!checked && atCap)} onCheckedChange={() => toggle(animal)} />
                <Avatar className="size-8">
                  <AvatarFallback>{(animal.name ?? animal.tagNumber).slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{animal.name ?? animal.tagNumber}</span>
                  <span className="truncate text-xs text-muted-foreground">{animal.tagNumber}</span>
                </span>
              </label>
            );
          })
        )}
      </div>
      {truncated ? <p className="text-xs text-muted-foreground">{t("moreThanShown", { count: MAX_REPORT_ANIMALS })}</p> : null}
    </div>
  );
}

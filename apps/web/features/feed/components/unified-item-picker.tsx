"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, ChevronsUpDown, Package, Plus, Sparkles, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Chip } from "@rakhal/ui/ui/chip";
import { useCreateCustomIngredient, useFeedIngredients } from "../hooks/use-feed";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { effectiveFromLot, itemStockKg } from "../lib/recipe-line";
import type { CreateCustomIngredientPayload, FeedClass, FeedIngredient } from "../types";
import type { FeedItem } from "@/features/inventory/types";
import type { CreateFeedFormItem } from "../schemas";

export interface UnifiedItemPickerProps {
  items: CreateFeedFormItem[];
  onSelectCatalogue: (ingredient: FeedIngredient) => void;
  onSelectInventory: (item: FeedItem) => void;
  onRemoveCatalogue?: (ingredientId: string) => void;
  onRemoveInventory?: (feedItemId: string) => void;
  placeholder?: string;
  className?: string;
}

const CLASS_ORDER: { feedClass: FeedClass; labelKey: string }[] = [
  { feedClass: "FORAGE", labelKey: "classForage" },
  { feedClass: "CONCENTRATE", labelKey: "classConcentrate" },
  { feedClass: "MINERAL", labelKey: "classMineral" },
  { feedClass: "VITAMIN", labelKey: "classVitamin" },
  { feedClass: "ADDITIVE", labelKey: "classAdditive" },
  { feedClass: "OTHER", labelKey: "classOther" },
];

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

type NutritionFieldKey =
  | "dmPct"
  | "cpPct"
  | "meMjPerKgDm"
  | "fatPct"
  | "ndfPct"
  | "rdpPct"
  | "rupPct"
  | "starchPct"
  | "adfPct"
  | "calciumPct"
  | "phosphorusPct"
  | "tdnPct";

const emptyNutrition: Record<NutritionFieldKey, number | undefined> = {
  dmPct: undefined,
  cpPct: undefined,
  meMjPerKgDm: undefined,
  fatPct: undefined,
  ndfPct: undefined,
  rdpPct: undefined,
  rupPct: undefined,
  starchPct: undefined,
  adfPct: undefined,
  calciumPct: undefined,
  phosphorusPct: undefined,
  tdnPct: undefined,
};

type SourceFilter = "all" | "inventory" | "catalogue";

/**
 * Unified "Add Items" picker for the Feed Formulator (Concentrate Mixer & TMR).
 * Combines Farm Inventory items and Rakhal Catalogue ingredients into a single, UX-friendly
 * searchable list with clear source badges, available stock indicators, and quick-add custom ingredient.
 */
export function UnifiedItemPicker({
  items,
  onSelectCatalogue,
  onSelectInventory,
  onRemoveCatalogue,
  onRemoveInventory,
  placeholder,
  className,
}: UnifiedItemPickerProps) {
  const t = useTranslations("feed");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [mode, setMode] = useState<"search" | "custom">("search");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState<number | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nutrition, setNutrition] = useState(emptyNutrition);

  const { data: catalogueIngredients, isLoading: catalogueLoading } = useFeedIngredients();
  const feedItemsPaged = useFeedItemPagedList({ search: search || undefined });
  const createCustom = useCreateCustomIngredient();

  const selectedCatalogueIds = useMemo(
    () => new Set(items.map((i) => i.ingredientId).filter((id): id is string => Boolean(id))),
    [items],
  );

  const selectedInventoryIds = useMemo(
    () => new Set(items.map((i) => i.feedItemId).filter((id): id is string => Boolean(id))),
    [items],
  );

  const filteredInventoryItems = useMemo(() => {
    const list = feedItemsPaged.items ?? [];
    if (!search.trim()) return list;
    const lower = search.toLowerCase();
    return list.filter((item) => item.name.toLowerCase().includes(lower));
  }, [feedItemsPaged.items, search]);

  const filteredCatalogueByClass = useMemo(() => {
    const list = catalogueIngredients ?? [];
    const lower = search.toLowerCase();
    const filtered = list.filter((ing) => {
      if (!search.trim()) return true;
      return (
        ing.name_en.toLowerCase().includes(lower) ||
        (ing.name_bn && ing.name_bn.toLowerCase().includes(lower))
      );
    });

    return CLASS_ORDER.map(({ feedClass, labelKey }) => ({
      feedClass,
      labelKey,
      ingredients: filtered.filter((ing) => ing.feed_class === feedClass),
    })).filter((g) => g.ingredients.length > 0);
  }, [catalogueIngredients, search]);

  function reset() {
    setSearch("");
    setSourceFilter("all");
    setMode("search");
    setCustomName("");
    setCustomPrice(undefined);
    setShowAdvanced(false);
    setNutrition(emptyNutrition);
  }

  function setNutritionField(key: NutritionFieldKey, value: number | undefined) {
    setNutrition((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCatalogue(ingredient: FeedIngredient) {
    if (selectedCatalogueIds.has(ingredient.id)) {
      onRemoveCatalogue?.(ingredient.id);
    } else {
      onSelectCatalogue(ingredient);
    }
  }

  function toggleInventory(item: FeedItem) {
    if (selectedInventoryIds.has(item.id)) {
      onRemoveInventory?.(item.id);
    } else {
      onSelectInventory(item);
    }
  }

  async function submitCustom() {
    if (!customName.trim() || customPrice == null) return;
    const payload: CreateCustomIngredientPayload = {
      name: customName.trim(),
      pricePerKg: customPrice,
      ...(showAdvanced ? nutrition : {}),
    };
    const created = await createCustom.mutateAsync(payload);
    // Find the created ingredient in catalogue or build a synthetic one to add
    onSelectCatalogue({
      id: created.id,
      name_en: created.name_en,
      name_bn: created.name_bn,
      feed_class: created.feed_class,
      feed_sub_type: created.feed_sub_type,
      nutrient_group: created.nutrient_group,
      is_custom: true,
      nutrition_source: created.nutrition_source,
      rakhal_price_per_kg: created.rakhal_price_per_kg,
      price_updated_at: created.price_updated_at,
      effective_price_per_kg: created.effective_price_per_kg,
      price_source: created.price_source,
      has_nutrition_override: created.has_nutrition_override,
      is_available_bd: created.is_available_bd,
      nutrition: created.nutrition,
      override_notes: created.override_notes,
    });
    setMode("search");
    setCustomName("");
    setCustomPrice(undefined);
    setShowAdvanced(false);
    setNutrition(emptyNutrition);
  }

  const nutritionFields: { key: NutritionFieldKey; labelKey: string; max?: number }[] = [
    { key: "dmPct", labelKey: "customDmPct", max: 100 },
    { key: "cpPct", labelKey: "customCpPct", max: 100 },
    { key: "meMjPerKgDm", labelKey: "customMePerKgDm" },
    { key: "fatPct", labelKey: "customFatPct", max: 100 },
    { key: "ndfPct", labelKey: "customNdfPct", max: 100 },
    { key: "rdpPct", labelKey: "customRdpPct", max: 100 },
    { key: "rupPct", labelKey: "customRupPct", max: 100 },
    { key: "starchPct", labelKey: "customStarchPct", max: 100 },
    { key: "adfPct", labelKey: "customAdfPct", max: 100 },
    { key: "calciumPct", labelKey: "customCalciumPct", max: 100 },
    { key: "phosphorusPct", labelKey: "customPhosphorusPct", max: 100 },
    { key: "tdnPct", labelKey: "customTdnPct", max: 100 },
  ];

  const hasInventory = (sourceFilter === "all" || sourceFilter === "inventory") && filteredInventoryItems.length > 0;
  const hasCatalogue = (sourceFilter === "all" || sourceFilter === "catalogue") && filteredCatalogueByClass.length > 0;
  const isLoading = catalogueLoading || feedItemsPaged.isLoading;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      modal={false}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="primary" size="sm" className={cn("gap-2 rounded-lg font-medium", className)}>
          <Plus className="size-4" aria-hidden />
          {placeholder ?? t("addItems")}
          <ChevronsUpDown className="size-3.5 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[390px] sm:w-[460px] p-0 shadow-xl" align="end">
        {mode === "search" ? (
          <Command shouldFilter={false} className="rounded-xl">
            <div className="flex flex-col gap-2 border-b border-border p-2.5">
              <CommandInput
                placeholder={t("searchIngredient")}
                value={search}
                onValueChange={setSearch}
                className="h-9"
              />
              <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5 text-xs font-medium">
                {(["all", "inventory", "catalogue"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSourceFilter(tab)}
                    className={cn(
                      "flex-1 rounded-md py-1 text-center transition-colors",
                      sourceFilter === tab
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab === "all"
                      ? t("allSources")
                      : tab === "inventory"
                        ? t("sourceInventory")
                        : t("sourceCatalogue")}
                  </button>
                ))}
              </div>
            </div>

            <CommandList className="max-h-80 overflow-y-auto p-1">
              {!hasInventory && !hasCatalogue ? (
                <CommandEmpty>{isLoading ? t("loading") : t("noIngredientsFound")}</CommandEmpty>
              ) : null}

              {/* INVENTORY ITEMS SECTION */}
              {(sourceFilter === "all" || sourceFilter === "inventory") && filteredInventoryItems.length > 0 ? (
                <CommandGroup heading={t("sourceInventory")}>
                  {filteredInventoryItems.map((item) => {
                    const isSelected = selectedInventoryIds.has(item.id);
                    const stockKg = Math.round(itemStockKg(item) * 100) / 100;
                    const lot = effectiveFromLot(item);
                    return (
                      <CommandItem
                        key={`inv-${item.id}`}
                        value={`inv ${item.name} ${item.id}`}
                        onSelect={() => toggleInventory(item)}
                        className="flex items-center justify-between gap-2 py-2 cursor-pointer"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <div
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40 bg-transparent",
                            )}
                            aria-hidden
                          >
                            <Check className={cn("size-3 text-current", isSelected ? "opacity-100" : "opacity-0")} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground text-sm truncate">{item.name}</span>
                              <Chip variant="teal" className="px-1.5 py-0 text-xs font-normal gap-1">
                                <Package className="size-2.5 shrink-0" aria-hidden />
                                {t("sourceInventory")}
                              </Chip>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span className={cn(stockKg <= 0 ? "text-destructive font-medium" : "text-success font-medium")}>
                                {stockKg > 0 ? t("inStockBadge", { stock: stockKg }) : t("outOfStockBadge")}
                              </span>
                              {lot ? (
                                <>
                                  <span>·</span>
                                  <span>DM {lot.dmPct}%</span>
                                  <span>·</span>
                                  <span>CP {lot.cpPct}%</span>
                                  <span>·</span>
                                  <span>৳{Math.round(lot.pricePerKg * 100) / 100}/kg</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <Chip variant="primary" className="px-1.5 py-0 text-xs shrink-0">
                            {t("addedBadge")}
                          </Chip>
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}

              {/* RAKHAL CATALOGUE INGREDIENTS SECTION */}
              {(sourceFilter === "all" || sourceFilter === "catalogue") &&
                filteredCatalogueByClass.map(({ feedClass, labelKey, ingredients }) => (
                  <CommandGroup key={feedClass} heading={t(labelKey)}>
                    {ingredients.map((ing) => {
                      const isSelected = selectedCatalogueIds.has(ing.id);
                      return (
                        <CommandItem
                          key={`cat-${ing.id}`}
                          value={`cat ${ing.name_en} ${ing.name_bn ?? ""} ${ing.id}`}
                          onSelect={() => toggleCatalogue(ing)}
                          className="flex items-center justify-between gap-2 py-2 cursor-pointer"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <div
                              className={cn(
                                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/40 bg-transparent",
                              )}
                              aria-hidden
                            >
                              <Check className={cn("size-3 text-current", isSelected ? "opacity-100" : "opacity-0")} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-foreground text-sm truncate">{ing.name_en}</span>
                                <Chip variant="info" className="px-1.5 py-0 text-xs font-normal gap-1">
                                  <Wheat className="size-2.5 shrink-0" aria-hidden />
                                  {t("sourceCatalogue")}
                                </Chip>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>DM {ing.nutrition.dm_pct}%</span>
                                <span>·</span>
                                <span>CP {ing.nutrition.cp_pct}%</span>
                                <span>·</span>
                                <span>ME {ing.nutrition.me_mj_per_kg_dm} MJ</span>
                                <span>·</span>
                                <span>৳{ing.effective_price_per_kg}/kg</span>
                              </div>
                            </div>
                          </div>

                          {isSelected ? (
                            <Chip variant="primary" className="px-1.5 py-0 text-xs shrink-0">
                              {t("addedBadge")}
                            </Chip>
                          ) : null}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
            </CommandList>

            <div className="border-t border-border p-1.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setMode("custom")}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="size-4" aria-hidden />
                {t("addCustomIngredient")}
              </button>
            </div>
          </Command>
        ) : (
          <div className="flex max-h-[30rem] flex-col gap-3 overflow-y-auto p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden />
              <p className="text-sm font-semibold text-foreground">{t("addCustomIngredient")}</p>
            </div>
            <LabeledInput
              id="custom-ingredient-name"
              label={t("customName")}
              placeholder={t("customNamePlaceholder")}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <LabeledInput
              id="custom-ingredient-price"
              type="number"
              min={0}
              step="0.01"
              label={t("customCost")}
              value={customPrice ?? ""}
              onChange={(e) => setCustomPrice(numberField.setValueAs(e.target.value))}
            />

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", showAdvanced && "rotate-180")} aria-hidden />
              {t("advancedNutritionProfile")}
            </button>

            {showAdvanced ? (
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5">
                <p className="col-span-2 text-xs leading-tight text-muted-foreground mb-1">
                  {t("advancedNutritionHint")}
                </p>
                {nutritionFields.map(({ key, labelKey, max }) => (
                  <LabeledInput
                    key={key}
                    id={`custom-ingredient-${key}`}
                    type="number"
                    min={0}
                    max={max}
                    step="0.01"
                    label={t(labelKey)}
                    value={nutrition[key] ?? ""}
                    onChange={(e) => setNutritionField(key, numberField.setValueAs(e.target.value))}
                    className="h-9 text-sm"
                  />
                ))}
              </div>
            ) : null}

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setMode("search")}>
                {t("back")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={!customName.trim() || customPrice == null || createCustom.isPending}
                onClick={submitCustom}
              >
                {createCustom.isPending ? "…" : t("addItem")}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

"use client"; // search-select over the cached ingredient catalogue + a custom-ingredient quick-add form

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { LabeledInput } from "@/components/ui/labeled-field";
import { useCreateCustomIngredient, useFeedIngredients } from "../hooks/use-feed";
import type { CreateCustomIngredientPayload, FeedClass } from "../types";

export interface IngredientOption {
  id: string;
  nameEn: string;
}

/** Feed-class display order + i18n key (user request 2026-07-18 — "use any of his concentrate
 * templates and add more items" — grouping by class lets a farmer tell a finalized Concentrate
 * Mixer template (`feed_class: CONCENTRATE`) apart from a raw ingredient at a glance in a Feed
 * Mixture's picker). Order mirrors how a nutritionist builds a ration: forage first, then
 * concentrate, then minerals/vitamins/additives (`feed_taxonomy_unification`). */
const CLASS_ORDER: { feedClass: FeedClass; labelKey: string }[] = [
  { feedClass: "FORAGE", labelKey: "classForage" },
  { feedClass: "CONCENTRATE", labelKey: "classConcentrate" },
  { feedClass: "MINERAL", labelKey: "classMineral" },
  { feedClass: "VITAMIN", labelKey: "classVitamin" },
  { feedClass: "ADDITIVE", labelKey: "classAdditive" },
  { feedClass: "OTHER", labelKey: "classOther" },
];

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

/** The 12 optional nutrition fields a farm can fill in on the "Advanced" quick-add section — same
 * keys as `CreateCustomIngredientPayload`. rdp/rup are % of CP, everything else % of DM. */
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

/** "Add New Item" (Figma `1065:36651`) — same search-select shape as `CattlePicker`, over the merged
 * ingredient catalogue (`GET /feed/ingredients`, Admin catalogue × this farm's overrides + this
 * farm's own quick-add rows) instead of cattle. Excludes ingredients already on the formula
 * (`excludeIds`) so the same line can't be added twice.
 *
 * Also hosts "Add Custom Ingredient" (user request 2026-07-17, no Figma frame): when the ingredient
 * a user wants isn't in the catalogue, they can quick-add one with just a Name + Cost per kg, plus
 * an optional collapsible "Advanced: full nutrition profile" section (all 12 unified nutrient fields,
 * same set the Admin catalogue/farm overrides use — real backend gap flagged not faked: only Rakhal
 * Admin can add a fully-speced catalogue ingredient, PRD §4.1, so this posts to
 * `POST /feed/ingredients/custom`, a farm-scoped row). No category/nutrient-group tag is collected
 * (removed 2026-07-17 — it was a display-only Protein/Energy/Fiber tag that nothing in the app
 * rendered, so a farm had no meaningful way to answer it; `nutrientGroup` stays optional on the
 * backend for anything that set it earlier). Leaving the Advanced fields blank keeps the original
 * "cost-only" behavior (dmPct defaults 100, everything else 0 — see that endpoint's backend doc
 * comment); filling them in makes this ingredient behave exactly like a catalogue ingredient in
 * every downstream formula. No Figma frame exists for a 12-field form, so it's built as a plain
 * collapsible section using the same `LabeledInput` primitive already used elsewhere in this
 * picker, not a new design pattern. */
export function IngredientPicker({
  onSelect,
  excludeIds,
  placeholder,
  className,
}: {
  onSelect: (option: IngredientOption) => void;
  excludeIds: string[];
  placeholder?: string;
  className?: string;
}) {
  const t = useTranslations("feed");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"search" | "custom">("search");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState<number | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nutrition, setNutrition] = useState(emptyNutrition);

  const { data, isLoading } = useFeedIngredients();
  const createCustom = useCreateCustomIngredient();

  const optionsByClass = useMemo(() => {
    const excluded = new Set(excludeIds);
    const filtered = (data ?? [])
      .filter((ing) => !excluded.has(ing.id))
      .filter((ing) => ing.name_en.toLowerCase().includes(search.toLowerCase()));
    return CLASS_ORDER.map(({ feedClass, labelKey }) => ({
      feedClass,
      labelKey,
      options: filtered
        .filter((ing) => ing.feed_class === feedClass)
        .map((ing) => ({ id: ing.id, nameEn: ing.name_en })),
    })).filter((g) => g.options.length > 0);
  }, [data, excludeIds, search]);

  function reset() {
    setSearch("");
    setMode("search");
    setCustomName("");
    setCustomPrice(undefined);
    setShowAdvanced(false);
    setNutrition(emptyNutrition);
  }

  function setNutritionField(key: NutritionFieldKey, value: number | undefined) {
    setNutrition((prev) => ({ ...prev, [key]: value }));
  }

  async function submitCustom() {
    if (!customName.trim() || customPrice == null) return;
    const payload: CreateCustomIngredientPayload = {
      name: customName.trim(),
      pricePerKg: customPrice,
      ...(showAdvanced ? nutrition : {}),
    };
    const created = await createCustom.mutateAsync(payload);
    onSelect({ id: created.id, nameEn: created.name_en });
    setOpen(false);
    reset();
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

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      // `modal={false}` — defense-in-depth alongside `create-feed-dialog.tsx`'s `Sheet` (see that
      // file's doc comment for the actual root cause/fix of the mouse-wheel-scroll bug, user report
      // 2026-07-18: the Sheet's own scroll lock was what intercepted wheel events here, confirmed by
      // dispatching a `wheel` event and checking `defaultPrevented`; setting `modal={false}` on just
      // this Popover alone did not fix it). Kept non-modal anyway so this picker never installs its
      // own additional lock when reused somewhere without a modal parent.
      modal={false}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="primary" size="sm" className={cn("gap-2 rounded-lg", className)}>
          {placeholder ?? t("addNewItem")}
          <ChevronsUpDown className="size-3.5 opacity-80" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        {mode === "search" ? (
          <Command shouldFilter={false}>
            <CommandInput placeholder={t("searchIngredient")} value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{isLoading ? t("loading") : t("noIngredientsFound")}</CommandEmpty>
              {optionsByClass.map(({ feedClass, labelKey, options }) => (
                <CommandGroup key={feedClass} heading={t(labelKey)}>
                  {options.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.id}
                      onSelect={() => {
                        onSelect(option);
                        setOpen(false);
                        reset();
                      }}
                    >
                      <Check className="mr-2 size-4 opacity-0" aria-hidden />
                      {option.nameEn}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => setMode("custom")}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary transition-colors hover:bg-muted"
              >
                <Plus className="size-4" aria-hidden />
                {t("addCustomIngredient")}
              </button>
            </div>
          </Command>
        ) : (
          <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto p-3">
            <p className="text-sm font-medium text-foreground">{t("addCustomIngredient")}</p>
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
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2">
                <p className="col-span-2 text-[11px] leading-tight text-muted-foreground">
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

            <div className="flex gap-2 pt-1">
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

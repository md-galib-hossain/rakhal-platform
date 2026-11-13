"use client"; // search-select over the merged unit catalogue + a custom-unit quick-add form

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import { Badge } from "@rakhal/ui/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rakhal/ui/ui/select";
import { useArchiveUnit, useCreateCustomUnit, useUnits } from "../hooks/use-inventory";
import type { CreateUnitPayload, Unit, UnitDimension } from "../types";

/** Dimension display order + i18n key — mirrors `features/feed/components/ingredient-picker.tsx`'s
 * `CLASS_ORDER` grouping convention (WEIGHT first since it's the dimension almost every
 * Medicine/FeedItem row uses, per the seeded catalog's own `orderBy` in `unit.service.ts`). */
const DIMENSION_ORDER: { dimension: UnitDimension; labelKey: string }[] = [
  { dimension: "WEIGHT", labelKey: "dimensionWeight" },
  { dimension: "VOLUME", labelKey: "dimensionVolume" },
  { dimension: "COUNT", labelKey: "dimensionCount" },
];

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

/**
 * Unit picker (RAKHAL-326) — replaces the free-text `unit`/`unitId` input on Medicine/Equipment/
 * FeedItem's create+edit forms (user request: "why in inventory we have unit as input while
 * creating an item we should use this as dropdown select ... also check for edit"). Same
 * Popover+Command search-select shape as `features/feed/components/ingredient-picker.tsx`, over
 * the merged system+farm unit catalog (`GET /inventory/units`) instead of ingredients, grouped by
 * `dimension` (Weight/Volume/Count) rather than feed class.
 *
 * Hosts a "+ Add custom unit" footer that flips the popover into an inline quick-add mini-form
 * (name, symbol, dimension select, optional conversion-to-base number field shown only for
 * WEIGHT/VOLUME — COUNT units like "bag"/"pcs" have no inherent weight/volume, per
 * `unit.prisma`'s doc comment), posts to `POST /inventory/units` (farm-custom row, `farmId` from
 * the token), and selects the newly created unit. Bound to `unitId` via react-hook-form's
 * `Controller` in the 3 form dialogs (not a plain input, so `register` doesn't apply).
 */
export function UnitPicker({
  value,
  onChange,
  placeholder,
  className,
  error,
}: {
  /** Currently selected `Unit.id`, or `undefined`/empty for none (Equipment's `unitId` is optional). */
  value: string | undefined;
  onChange: (unitId: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}) {
  const t = useTranslations("inventory.unitPicker");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"search" | "custom">("search");
  const [customName, setCustomName] = useState("");
  const [customSymbol, setCustomSymbol] = useState("");
  const [customDimension, setCustomDimension] = useState<UnitDimension>("COUNT");
  const [customConversion, setCustomConversion] = useState<number | undefined>(undefined);

  const { data, isLoading } = useUnits();
  const createCustom = useCreateCustomUnit();
  const archiveUnit = useArchiveUnit();
  const [archivingId, setArchivingId] = useState<string | null>(null);

  async function handleArchive(unit: Unit) {
    setArchivingId(unit.id);
    try {
      await archiveUnit.mutateAsync(unit.id);
      toast.success(t("unitArchived", { name: unit.name }));
      if (unit.id === value) onChange("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("archiveUnitError"));
    } finally {
      setArchivingId(null);
    }
  }

  const selected = useMemo(() => data?.find((u) => u.id === value), [data, value]);

  const groupsByDimension = useMemo(() => {
    const filtered = (data ?? []).filter(
      (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.symbol.toLowerCase().includes(search.toLowerCase()),
    );
    return DIMENSION_ORDER.map(({ dimension, labelKey }) => ({
      dimension,
      labelKey,
      options: filtered.filter((u) => u.dimension === dimension),
    })).filter((g) => g.options.length > 0);
  }, [data, search]);

  function reset() {
    setSearch("");
    setMode("search");
    setCustomName("");
    setCustomSymbol("");
    setCustomDimension("COUNT");
    setCustomConversion(undefined);
  }

  function selectUnit(unit: Unit) {
    onChange(unit.id);
    setOpen(false);
    reset();
  }

  async function submitCustom() {
    if (!customName.trim() || !customSymbol.trim()) return;
    const payload: CreateUnitPayload = {
      name: customName.trim(),
      symbol: customSymbol.trim(),
      dimension: customDimension,
      conversionToBase: customDimension === "COUNT" ? undefined : customConversion,
    };
    const created = await createCustom.mutateAsync(payload);
    selectUnit(created);
  }

  const showConversionField = customDimension === "WEIGHT" || customDimension === "VOLUME";

  return (
    <div className={cn("w-full", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        // Same `modal={false}` defense-in-depth as `IngredientPicker` — kept non-modal so this
        // picker never installs its own scroll lock when reused inside a `Sheet` form drawer.
        modal={false}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-4 py-2 text-left shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring",
              error && "border-destructive focus-within:ring-destructive",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-muted-foreground">{t("unit")}</span>
              <span className={cn("truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
                {selected ? `${selected.name} (${selected.symbol})` : (placeholder ?? t("selectUnit"))}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0">
          {mode === "search" ? (
            <Command shouldFilter={false}>
              <CommandInput placeholder={t("searchUnit")} value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>{isLoading ? t("loading") : t("noUnitsFound")}</CommandEmpty>
                {groupsByDimension.map(({ dimension, labelKey, options }) => (
                  <CommandGroup key={dimension} heading={t(labelKey)}>
                    {options.map((unit) => (
                      <CommandItem
                        key={unit.id}
                        value={unit.id}
                        onSelect={() => selectUnit(unit)}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center">
                          <Check className={cn("mr-2 size-4", unit.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                          {unit.name} ({unit.symbol})
                          {!unit.isSystemDefault ? (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {t("customUnitBadge")}
                            </Badge>
                          ) : null}
                        </span>
                        {!unit.isSystemDefault ? (
                          <button
                            type="button"
                            disabled={archivingId === unit.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleArchive(unit);
                            }}
                            aria-label={t("archiveUnit", { name: unit.name })}
                            className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        ) : null}
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
                  {t("addCustomUnit")}
                </button>
              </div>
            </Command>
          ) : (
            <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto p-3">
              <p className="text-sm font-medium text-foreground">{t("addCustomUnit")}</p>
              <LabeledInput
                id="custom-unit-name"
                label={t("unitName")}
                placeholder={t("unitNamePlaceholder")}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <LabeledInput
                id="custom-unit-symbol"
                label={t("unitSymbol")}
                placeholder={t("unitSymbolPlaceholder")}
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <Select value={customDimension} onValueChange={(v) => setCustomDimension(v as UnitDimension)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("unitDimension")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEIGHT">{t("dimensionWeight")}</SelectItem>
                    <SelectItem value="VOLUME">{t("dimensionVolume")}</SelectItem>
                    <SelectItem value="COUNT">{t("dimensionCount")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {showConversionField ? (
                <LabeledInput
                  id="custom-unit-conversion"
                  type="number"
                  min={0}
                  step="0.0001"
                  label={t("conversionToBase")}
                  placeholder={customDimension === "WEIGHT" ? t("conversionToBaseHintWeight") : t("conversionToBaseHintVolume")}
                  value={customConversion ?? ""}
                  onChange={(e) => setCustomConversion(numberField.setValueAs(e.target.value))}
                />
              ) : null}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setMode("search")}>
                  {t("back")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={!customName.trim() || !customSymbol.trim() || createCustom.isPending}
                  onClick={submitCustom}
                >
                  {createCustom.isPending ? "…" : t("addItem")}
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

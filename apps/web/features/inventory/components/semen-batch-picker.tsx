"use client"; // search-select over active SemenBatches + an inline quick-add form

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@rakhal/ui/ui/command";
import { LabeledInput } from "@rakhal/ui/ui/labeled-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rakhal/ui/ui/select";
import { useCreateSemenBatch, useSemenBatches } from "../hooks/use-inventory";
import type { CreateSemenBatchPayload, SemenBatch, SemenType, TargetSex } from "../types";

/**
 * `SemenBatchPicker` — search-select dropdown with an inline quick-add form for semen straw batches.
 * Matches the same Popover + Command + inline quick-add shape as `AccountPicker`, `UnitPicker`,
 * and `ServiceProviderPicker`.
 */
export function SemenBatchPicker({
  value,
  onChange,
  onBatchChange,
  placeholder,
  className,
  error,
  disabled,
}: {
  /** Currently selected `SemenBatch.id`, or `undefined` for none. */
  value: string | undefined;
  onChange: (batchId: string) => void;
  onBatchChange?: (batch: SemenBatch | undefined) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("inventory.semenBatchPicker");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"search" | "custom">("search");
  const [draftName, setDraftName] = useState("");
  const [draftStrawQuantity, setDraftStrawQuantity] = useState<number | "">("");
  const [draftCostPerUnit, setDraftCostPerUnit] = useState<number | "">("");
  const [draftBreed, setDraftBreed] = useState("");
  const [draftBatchCode, setDraftBatchCode] = useState("");
  const [draftSemenType, setDraftSemenType] = useState<SemenType>("CONVENTIONAL");
  const [draftTargetSex, setDraftTargetSex] = useState<TargetSex>("FEMALE");

  const { data: batches, isLoading } = useSemenBatches();
  const createBatch = useCreateSemenBatch();

  const selected = useMemo(() => (batches ?? []).find((b) => b.id === value), [batches, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches ?? [];
    return (batches ?? []).filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.batchCode && b.batchCode.toLowerCase().includes(q)) ||
        (b.breed && b.breed.toLowerCase().includes(q)),
    );
  }, [batches, search]);

  function reset() {
    setSearch("");
    setMode("search");
    setDraftName("");
    setDraftStrawQuantity("");
    setDraftCostPerUnit("");
    setDraftBreed("");
    setDraftBatchCode("");
    setDraftSemenType("CONVENTIONAL");
    setDraftTargetSex("FEMALE");
  }

  function selectBatch(batch: SemenBatch) {
    onChange(batch.id);
    onBatchChange?.(batch);
    setOpen(false);
    reset();
  }

  const isDraftValid =
    draftName.trim().length > 0 &&
    typeof draftStrawQuantity === "number" &&
    draftStrawQuantity > 0 &&
    typeof draftCostPerUnit === "number" &&
    draftCostPerUnit >= 0;

  async function submitCustom() {
    if (!isDraftValid) return;
    try {
      const payload: CreateSemenBatchPayload = {
        name: draftName.trim(),
        strawQuantity: Number(draftStrawQuantity),
        costPerUnit: Number(draftCostPerUnit),
        breed: draftBreed.trim() || undefined,
        batchCode: draftBatchCode.trim() || undefined,
        semenType: draftSemenType,
        targetSex: draftSemenType === "SEX_SORTED" ? draftTargetSex : undefined,
      };
      const created = await createBatch.mutateAsync(payload);
      toast.success(t("createdToast"));
      selectBatch(created);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        modal={false}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-4 py-2 text-left shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-destructive focus-within:ring-destructive",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-muted-foreground">{t("semenBatch")}</span>
              <span className={cn("truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
                {selected
                  ? `${selected.name}${selected.batchCode ? ` (${selected.batchCode})` : ""} — ${t("strawsLeft", { count: selected.strawQuantity })}`
                  : (placeholder ?? t("selectSemenBatch"))}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0">
          {mode === "search" ? (
            <Command shouldFilter={false}>
              <CommandInput placeholder={t("searchSemenBatch")} value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>{isLoading ? t("loading") : t("noBatchesFound")}</CommandEmpty>
                <CommandGroup>
                  {filtered.map((batch) => (
                    <CommandItem
                      key={batch.id}
                      value={batch.id}
                      onSelect={() => selectBatch(batch)}
                      className="flex items-center gap-2 py-2"
                    >
                      <Check className={cn("mr-2 size-4 shrink-0", batch.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {batch.name} {batch.batchCode ? `(${batch.batchCode})` : ""}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {batch.breed ? `${batch.breed} · ` : ""}
                          {t("strawsLeft", { count: batch.strawQuantity })}
                          {batch.costPerUnit != null ? ` · ৳${batch.costPerUnit}/straw` : ""}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
              <div className="border-t border-border p-1">
                <button
                  type="button"
                  onClick={() => setMode("custom")}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary transition-colors hover:bg-muted"
                >
                  <Plus className="size-4" aria-hidden />
                  {t("addSemenBatch")}
                </button>
              </div>
            </Command>
          ) : (
            <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto p-3">
              <p className="text-sm font-medium text-foreground">{t("addSemenBatch")}</p>

              <LabeledInput
                id="draft-semen-name"
                label={t("batchName")}
                placeholder={t("batchNamePlaceholder")}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-2">
                <LabeledInput
                  id="draft-straw-quantity"
                  type="number"
                  min={1}
                  label={t("strawQuantity")}
                  placeholder={t("strawQuantityPlaceholder")}
                  value={draftStrawQuantity}
                  onChange={(e) => setDraftStrawQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <LabeledInput
                  id="draft-cost-per-unit"
                  type="number"
                  min={0}
                  step="0.01"
                  label={t("costPerUnit")}
                  placeholder={t("costPerUnitPlaceholder")}
                  value={draftCostPerUnit}
                  onChange={(e) => setDraftCostPerUnit(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <LabeledInput
                  id="draft-breed"
                  label={t("breed")}
                  placeholder={t("breedPlaceholder")}
                  value={draftBreed}
                  onChange={(e) => setDraftBreed(e.target.value)}
                />
                <LabeledInput
                  id="draft-batch-code"
                  label={t("batchCode")}
                  placeholder={t("batchCodePlaceholder")}
                  value={draftBatchCode}
                  onChange={(e) => setDraftBatchCode(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t("semenType")}</span>
                <Select
                  value={draftSemenType}
                  onValueChange={(v) => {
                    setDraftSemenType(v as SemenType);
                    if (v !== "SEX_SORTED") setDraftTargetSex("FEMALE");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectSemenType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONVENTIONAL">{t("typeConventional")}</SelectItem>
                    <SelectItem value="SEX_SORTED">{t("typeSexSorted")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {draftSemenType === "SEX_SORTED" ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("targetSex")}</span>
                  <Select value={draftTargetSex} onValueChange={(v) => setDraftTargetSex(v as TargetSex)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectTargetSex")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FEMALE">{t("sexFemale")}</SelectItem>
                      <SelectItem value="MALE">{t("sexMale")}</SelectItem>
                    </SelectContent>
                  </Select>
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
                  disabled={!isDraftValid || createBatch.isPending}
                  onClick={submitCustom}
                >
                  {createBatch.isPending ? "…" : t("addItem")}
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

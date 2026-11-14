"use client"; // list state + add/edit sheet + delete-confirm

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightToLine, Plus, Wheat, ChevronDown } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@rakhal/ui/ui/sheet";
import { LabeledInput } from "@rakhal/ui/ui/labeled-field";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { RowActionsMenu } from "@rakhal/ui/shared/row-actions-menu";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Can, useCan } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import {
  useCreateCustomIngredient,
  useDeleteCustomIngredient,
  useIngredientPagedList,
  useResetIngredientOverride,
  useSetIngredientOverride,
  useUpdateCustomIngredient,
} from "../hooks/use-feed";
import { IngredientFilters } from "./ingredient-filters";
import type { CreateCustomIngredientPayload, FeedClass, FeedIngredient, SetFeedOverridePayload } from "../types";
import { TruncatedText } from "@rakhal/ui/shared/truncated-text";

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

function nutritionFromIngredient(ing: FeedIngredient): Record<NutritionFieldKey, number | undefined> {
  return {
    dmPct: ing.nutrition.dm_pct,
    cpPct: ing.nutrition.cp_pct,
    meMjPerKgDm: ing.nutrition.me_mj_per_kg_dm,
    fatPct: ing.nutrition.fat_pct ?? undefined,
    ndfPct: ing.nutrition.ndf_pct ?? undefined,
    rdpPct: ing.nutrition.rdp_pct ?? undefined,
    rupPct: ing.nutrition.rup_pct ?? undefined,
    starchPct: ing.nutrition.starch_pct ?? undefined,
    adfPct: ing.nutrition.adf_pct ?? undefined,
    calciumPct: ing.nutrition.calcium_pct ?? undefined,
    phosphorusPct: ing.nutrition.phosphorus_pct ?? undefined,
    tdnPct: ing.nutrition.tdn_pct ?? undefined,
  };
}

/** Shared 12-nutrient form body for both the add and edit sheets below — same field set/order as
 * `IngredientPicker`'s inline quick-add. */
function IngredientFormFields({
  name,
  onNameChange,
  price,
  onPriceChange,
  showAdvanced,
  onToggleAdvanced,
  nutrition,
  onNutritionChange,
}: {
  name: string;
  onNameChange: (v: string) => void;
  price: number | undefined;
  onPriceChange: (v: number | undefined) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  nutrition: Record<NutritionFieldKey, number | undefined>;
  onNutritionChange: (key: NutritionFieldKey, value: number | undefined) => void;
}) {
  const t = useTranslations("feed");
  return (
    <div className="flex flex-col gap-3">
      <LabeledInput
        id="mgmt-ingredient-name"
        label={t("customName")}
        placeholder={t("customNamePlaceholder")}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
      />
      <LabeledInput
        id="mgmt-ingredient-price"
        type="number"
        min={0}
        step="0.01"
        label={t("customCost")}
        value={price ?? ""}
        onChange={(e) => onPriceChange(numberField.setValueAs(e.target.value))}
      />
      <button
        type="button"
        onClick={onToggleAdvanced}
        className="flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={cn("size-3.5 transition-transform", showAdvanced && "rotate-180")} aria-hidden />
        {t("advancedNutritionProfile")}
      </button>
      {showAdvanced ? (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2">
          <p className="col-span-2 text-xs leading-tight text-muted-foreground">{t("advancedNutritionHint")}</p>
          {nutritionFields.map(({ key, labelKey, max }) => (
            <LabeledInput
              key={key}
              id={`mgmt-ingredient-${key}`}
              type="number"
              min={0}
              max={max}
              step="0.01"
              label={t(labelKey)}
              value={nutrition[key] ?? ""}
              onChange={(e) => onNutritionChange(key, numberField.setValueAs(e.target.value))}
              className="h-9 text-sm"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Feed Formulator — "Ingredients" section (user request 2026-08-14): a dedicated place to manage a
 * farm's own ingredients (add/edit/delete + price/nutrition) instead of only the buried inline
 * quick-add inside `IngredientPicker`. Lists the full merged catalogue (Admin rows + this farm's own)
 * read-only name/class/price/CP/ME columns; only this farm's own rows (`is_custom`) get Edit/Delete —
 * the global Admin catalogue is managed by Rakhal Admin, not a farm (backend-enforced 404 on any
 * attempt, and a row promoted from a finalized Concentrate Mixer is backend-rejected too — the toast
 * surfaces that message instead of silently failing). Concentrate Mixer's `IngredientPicker` and TMR
 * building both already search this same merged list (`GET /feed/ingredients`), so anything
 * added/edited here is immediately selectable there — no separate linkage needed. */
export function IngredientManagementTable() {
  const t = useTranslations("feed");
  const tm = useTranslations("feed.ingredientsManager");
  const tc = useTranslations("common");
  const can = useCan();
  const canUpdate = can("feed.update");
  const canDelete = can("feed.delete");
  const searchParams = useSearchParams();
  const filters = {
    search: searchParams.get("search") ?? undefined,
    feedClass: searchParams.get("feedClass")?.split(",").filter(Boolean) as FeedClass[] | undefined,
    priceMin: searchParams.get("priceMin") ? Number(searchParams.get("priceMin")) : undefined,
    priceMax: searchParams.get("priceMax") ? Number(searchParams.get("priceMax")) : undefined,
  };
  const query = useIngredientPagedList(filters);
  const data = query.items;
  const createCustom = useCreateCustomIngredient();
  const updateCustom = useUpdateCustomIngredient();
  const deleteCustom = useDeleteCustomIngredient();
  const setOverride = useSetIngredientOverride();
  const resetOverride = useResetIngredientOverride();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FeedIngredient | null>(null);
  const [editMode, setEditMode] = useState<"custom" | "override" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedIngredient | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nutrition, setNutrition] = useState(emptyNutrition);

  function resetForm() {
    setName("");
    setPrice(undefined);
    setShowAdvanced(false);
    setNutrition(emptyNutrition);
  }

  function openAdd() {
    resetForm();
    setEditTarget(null);
    setEditMode(null);
    setAddOpen(true);
  }

  function openEdit(ing: FeedIngredient) {
    setName(ing.name_en);
    setPrice(ing.effective_price_per_kg);
    setNutrition(nutritionFromIngredient(ing));
    setShowAdvanced(true);
    setEditTarget(ing);
    setEditMode(ing.is_custom ? "custom" : "override");
    setAddOpen(true);
  }

  async function handleResetOverride(ing: FeedIngredient) {
    try {
      await resetOverride.mutateAsync(ing.id);
      toast.success(tm("resetToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  function setNutritionField(key: NutritionFieldKey, value: number | undefined) {
    setNutrition((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!name.trim() || price == null) return;
    try {
      if (editTarget && editMode === "override") {
        const overridePayload: SetFeedOverridePayload = {
          customPricePerKg: price,
          ...(showAdvanced
            ? {
                customDmPct: nutrition.dmPct,
                customCpPct: nutrition.cpPct,
                customMeMjPerKgDm: nutrition.meMjPerKgDm,
                customFatPct: nutrition.fatPct,
                customNdfPct: nutrition.ndfPct,
                customRdpPct: nutrition.rdpPct,
                customRupPct: nutrition.rupPct,
                customStarchPct: nutrition.starchPct,
                customAdfPct: nutrition.adfPct,
                customCalciumPct: nutrition.calciumPct,
                customPhosphorusPct: nutrition.phosphorusPct,
                customTdnPct: nutrition.tdnPct,
              }
            : {}),
        };
        await setOverride.mutateAsync({ id: editTarget.id, dto: overridePayload });
        toast.success(tm("editedToast"));
      } else {
        const payload: CreateCustomIngredientPayload = {
          name: name.trim(),
          pricePerKg: price,
          ...(showAdvanced ? nutrition : {}),
        };
        if (editTarget) {
          await updateCustom.mutateAsync({ id: editTarget.id, dto: payload });
          toast.success(tm("editedToast"));
        } else {
          await createCustom.mutateAsync(payload);
          toast.success(tm("addedToast"));
        }
      }
      setAddOpen(false);
      resetForm();
      setEditTarget(null);
      setEditMode(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteCustom.mutateAsync(deleteTarget.id);
      toast.success(tm("deletedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const isSaving = createCustom.isPending || updateCustom.isPending || setOverride.isPending;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xl font-medium text-foreground">{tm("title")}</p>
        <Can I="feed.create">
          <Button variant="primary" className="gap-2" onClick={openAdd}>
            <Plus className="size-[18px]" aria-hidden />
            {tm("addIngredient")}
          </Button>
        </Can>
      </div>

      <IngredientFilters />

      {query.isLoading ? (
        <CardSkeleton lines={5} />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : data.length === 0 ? (
        <EmptyState icon={Wheat} title={tm("empty")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{tm("colName")}</th>
                <th className="py-2 pr-3 font-medium">{tm("colClass")}</th>
                <th className="py-2 pr-3 font-medium">{tm("colPrice")}</th>
                <th className="py-2 pr-3 font-medium">{tm("colCp")}</th>
                <th className="py-2 pr-3 font-medium">{tm("colMe")}</th>
                <th className="py-2 pr-3 font-medium">{tm("colSource")}</th>
                <th className="py-2 pr-3 font-medium text-right">{tm("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((ing) => (
                <tr key={ing.id} className="border-b border-border/60 last:border-0">
                  <td className="max-w-[18rem] py-2 pr-3 font-medium text-foreground"><TruncatedText>{ing.name_en}</TruncatedText></td>
                  <td className="py-2 pr-3 text-muted-foreground">{ing.feed_class}</td>
                  <td className="py-2 pr-3">৳{ing.effective_price_per_kg.toFixed(2)}</td>
                  <td className="py-2 pr-3">{ing.nutrition.cp_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-3">{ing.nutrition.me_mj_per_kg_dm.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {ing.is_custom ? tm("sourceCustom") : tm("sourceCatalogue")}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center justify-end">
                      <RowActionsMenu
                        menuLabel={tm("moreActions")}
                        actions={[
                          ...(canUpdate ? [{ key: "edit", label: tm("edit"), onSelect: () => openEdit(ing) }] : []),
                          ...(canUpdate && !ing.is_custom && (ing.has_nutrition_override || ing.price_source !== "rakhal_market")
                            ? [{ key: "reset", label: tm("resetOverride"), onSelect: () => handleResetOverride(ing) }]
                            : []),
                          ...(ing.is_custom && canUpdate && canDelete
                            ? [{ key: "delete", label: tm("delete"), destructive: true, onSelect: () => setDeleteTarget(ing) }]
                            : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!query.isLoading && !query.isError && data.length > 0 ? (
        <Pagination
          page={query.page}
          totalPages={query.totalPages}
          onPageChange={query.goToPage}
          isFetching={query.isFetching}
          pageSize={query.pageSize}
          onPageSizeChange={query.setPageSize}
        />
      ) : null}

      <Sheet
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            resetForm();
            setEditTarget(null);
            setEditMode(null);
          }
        }}
      >
        <SheetContent
          showClose={false}
          className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[680px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
        >
          <div className="flex items-center justify-between pb-5">
            <SheetTitle className="text-xl font-bold text-foreground">
              {editTarget ? tm("editTitle") : tm("addTitle")}
            </SheetTitle>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              aria-label={tc("close")}
              className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
            >
              <ArrowRightToLine className="size-5" aria-hidden />
            </button>
          </div>
          <div className="border-t border-border" />

          <div className="flex-1 overflow-y-auto px-1 py-4">
            <IngredientFormFields
              name={name}
              onNameChange={setName}
              price={price}
              onPriceChange={setPrice}
              showAdvanced={showAdvanced}
              onToggleAdvanced={() => setShowAdvanced((v) => !v)}
              nutrition={nutrition}
              onNutritionChange={setNutritionField}
            />
          </div>

          <div className="border-t border-border" />
          <div className="flex gap-3 pt-5">
            <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => setAddOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              className="h-12 flex-1"
              disabled={!name.trim() || price == null || isSaving}
              onClick={handleSubmit}
            >
              {isSaving ? "…" : editTarget ? tm("saveChanges") : t("addItem")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={tm("deleteConfirmTitle", { name: deleteTarget?.name_en ?? "" })}
        description={tm("deleteConfirmDescription")}
        confirmLabel={tm("delete")}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

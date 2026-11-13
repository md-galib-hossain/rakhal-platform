"use client"; // per-line actual-kg inputs + a real mutation on submit

import { todayLocalIso } from "@/lib/local-date";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@rakhal/ui/ui/sheet";
import { Button } from "@rakhal/ui/ui/button";
import { LabeledInput } from "@/components/ui/labeled-field";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { AnimalLink } from "@/components/shared/animal-link";
import { useCattleDetail } from "@/features/cattle/hooks/use-cattle";
import { useConcentrationDetail, useLogDistribution } from "../hooks/use-feed";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@rakhal/ui/ui/label";
import { IngredientPicker, type IngredientOption } from "./ingredient-picker";
import { X } from "lucide-react";
import { distributionLineKey } from "../lib/recipe-line";

function todayStr() {
  return todayLocalIso();
}

/**
 * "Feed Today" (Phase 12.4, 2026-07-18, no Figma frame — new surface, none of this existed
 * anywhere in the frontend before this pass) — logs an actual feeding against a Total Mixed
 * Ration's own target (one cow or the herd, always derived server-side from `concentrationId`,
 * never picked here). Single step, mirroring `record-batch-dialog.tsx`'s shell (read-only info
 * tiles + a confirm footer) rather than a multi-step wizard, since there's no target to pick — the
 * TMR already fixed that at creation. Per-ingredient actual-kg inputs default to the TMR's planned
 * amounts; leaving every one unchanged confirms exactly what was planned. No stock-lot picker (a
 * genuinely new-to-this-codebase UI surface the plan flagged as an open question) — `POST
 * /feed/distributions` auto-resolves the TMR's own finalized batch lot server-side
 * (`FeedDistributionService.create`'s "own stock" path), so this dialog never needs to know a
 * stock-lot id exists at all.
 */
export function LogDistributionDialog({
  concentrationId,
  onOpenChange,
}: {
  concentrationId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={concentrationId != null} onOpenChange={onOpenChange}>
      {concentrationId ? <LogDistributionDialogBody id={concentrationId} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function LogDistributionDialogBody({ id, onOpenChange }: { id: string; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("feed.logDistribution");
  const detail = useConcentrationDetail(id);
  const cattleId = detail.data?.target_type === "INDIVIDUAL" ? (detail.data.cattle_id ?? undefined) : undefined;
  const cattle = useCattleDetail(cattleId);
  const logDistribution = useLogDistribution();

  // Explicit user edits only — defaults to each line's planned amount until the farmer types over
  // it, avoiding a setState-in-effect resync once `detail.data` loads (see react-hooks/set-state-in-effect).
  const [actualOverrides, setActualOverrides] = useState<Record<string, number>>({});
  // Refusal/leftover — same-day estimate (2026-08-13, user request). Defaults to 0; a farmer who
  // doesn't know the leftover yet can skip this and record it next-day via `usePatchRefusal`.
  const [refusalOverrides, setRefusalOverrides] = useState<Record<string, number>>({});
  // User request 2026-09-23: "Feed Today" must not be limited to whatever's baked into the recipe
  // — a farm feeds whatever's actually in front of the cow. Extra lines, added on top of the fixed
  // recipe below, from the same ingredient catalogue the ration builder already uses.
  const [extraLines, setExtraLines] = useState<{ ingredientId: string; name: string; actualKg: number; refusalKg: number }[]>([]);
  const [notes, setNotes] = useState("");
  const [distributedAt, setDistributedAt] = useState(todayStr());
  const [submitting, setSubmitting] = useState(false);

  const actualByIngredient = Object.fromEntries(
    (detail.data?.ingredients ?? []).map((line) => [
      distributionLineKey(line),
      actualOverrides[distributionLineKey(line)] ?? line.amount_kg,
    ]),
  );

  const targetLabel =
    detail.data?.target_type === "HERD"
      ? t("wholeHerd")
      : (cattle.data?.name ?? cattle.data?.tagNumber ?? "—");

  const totalActualKg =
    Object.values(actualByIngredient).reduce((sum, v) => sum + (v || 0), 0) +
    extraLines.reduce((sum, l) => sum + l.actualKg, 0);

  function handleAddIngredient(option: IngredientOption) {
    setExtraLines((prev) => [...prev, { ingredientId: option.id, name: option.nameEn, actualKg: 0, refusalKg: 0 }]);
  }

  function handleRemoveExtraLine(ingredientId: string) {
    setExtraLines((prev) => prev.filter((l) => l.ingredientId !== ingredientId));
  }

  async function handleConfirm() {
    if (!detail.data) return;
    setSubmitting(true);
    try {
      await logDistribution.mutateAsync({
        concentrationId: id,
        distributedAt: distributedAt || undefined,
        notes: notes.trim() || undefined,
        items: [
          ...detail.data.ingredients.map((line) => ({
            ingredientId: distributionLineKey(line),
            actualKg: actualByIngredient[distributionLineKey(line)] ?? line.amount_kg,
            refusalKg: refusalOverrides[distributionLineKey(line)] ?? 0,
          })),
          ...extraLines.map((l) => ({
            ingredientId: l.ingredientId,
            actualKg: l.actualKg,
            refusalKg: l.refusalKg,
          })),
        ],
      });
      toast.success(t("loggedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[600px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[600px]"
    >
      <div className="flex items-start justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-4">
        {detail.isLoading ? (
          <CardSkeleton lines={4} />
        ) : detail.isError ? (
          <ErrorState onRetry={() => detail.refetch()} />
        ) : detail.data ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border p-2">
                <span className="text-xs font-bold text-muted-foreground">{t("feedName")}</span>
                <p className="truncate text-sm text-foreground">{detail.data.name}</p>
              </div>
              <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border p-2">
                <span className="text-xs font-bold text-muted-foreground">
                  {detail.data.target_type === "HERD" ? t("targetHerd") : t("targetCow")}
                </span>
                {detail.data.target_type === "INDIVIDUAL" && cattleId ? (
                  <AnimalLink id={cattleId} animalName={cattle.data?.name} tagNumber={cattle.data?.tagNumber} className="truncate text-sm font-normal text-foreground" />
                ) : (
                  <p className="truncate text-sm text-foreground">{targetLabel}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="distributedAt">{t("date")}</Label>
              <DatePicker id="distributedAt" label={t("date")} value={distributedAt} onChange={setDistributedAt} />
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-foreground">{t("ingredients")}</p>
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {detail.data.ingredients.map((line) => (
                  <div key={distributionLineKey(line)} className="flex items-center justify-between gap-3 p-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{line.name ?? distributionLineKey(line)}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("planned")}: {line.amount_kg} kg
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-24 items-center gap-1 rounded-lg bg-muted px-2 shadow-xs">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={actualByIngredient[distributionLineKey(line)] ?? line.amount_kg}
                          onChange={(e) =>
                            setActualOverrides((prev) => ({
                              ...prev,
                              [distributionLineKey(line)]: Number(e.target.value) || 0,
                            }))
                          }
                          className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none"
                          aria-label={t("actualKg")}
                        />
                        <span className="text-xs text-muted-foreground">kg</span>
                      </div>
                      <div className="flex h-9 w-20 flex-col items-center justify-center rounded-lg bg-muted px-2 shadow-xs">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0"
                          value={refusalOverrides[distributionLineKey(line)] ?? ""}
                          onChange={(e) =>
                            setRefusalOverrides((prev) => ({
                              ...prev,
                              [distributionLineKey(line)]: Number(e.target.value) || 0,
                            }))
                          }
                          className="w-full border-0 bg-transparent p-0 text-center text-sm text-foreground outline-none"
                          aria-label={t("refusalKg")}
                        />
                        <span className="text-xs text-muted-foreground">{t("refusalShort")}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {extraLines.map((line) => (
                  <div key={line.ingredientId} className="flex items-center justify-between gap-3 p-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{line.name}</span>
                      <span className="text-xs text-muted-foreground">{t("notPlanned")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-24 items-center gap-1 rounded-lg bg-muted px-2 shadow-xs">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.actualKg}
                          onChange={(e) =>
                            setExtraLines((prev) =>
                              prev.map((l) =>
                                l.ingredientId === line.ingredientId
                                  ? { ...l, actualKg: Number(e.target.value) || 0 }
                                  : l,
                              ),
                            )
                          }
                          className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none"
                          aria-label={t("actualKg")}
                        />
                        <span className="text-xs text-muted-foreground">kg</span>
                      </div>
                      <div className="flex h-9 w-20 flex-col items-center justify-center rounded-lg bg-muted px-2 shadow-xs">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0"
                          value={line.refusalKg || ""}
                          onChange={(e) =>
                            setExtraLines((prev) =>
                              prev.map((l) =>
                                l.ingredientId === line.ingredientId
                                  ? { ...l, refusalKg: Number(e.target.value) || 0 }
                                  : l,
                              ),
                            )
                          }
                          className="w-full border-0 bg-transparent p-0 text-center text-sm text-foreground outline-none"
                          aria-label={t("refusalKg")}
                        />
                        <span className="text-xs text-muted-foreground">{t("refusalShort")}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraLine(line.ingredientId)}
                        aria-label={t("removeLine")}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <IngredientPicker
                onSelect={handleAddIngredient}
                excludeIds={[...detail.data.ingredients.map((l) => distributionLineKey(l)), ...extraLines.map((l) => l.ingredientId)]}
                placeholder={t("addIngredient")}
                className="self-start"
              />
            </div>

            <LabeledInput
              id="notes"
              label={t("notes")}
              placeholder={t("notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </>
        ) : null}
      </div>

      <div className="border-t border-dashed border-border" />
      <div className="flex flex-col gap-3 pt-5">
        <p className="text-xs text-muted-foreground">{t("totalActual", { value: totalActualKg.toFixed(2) })}</p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="button" className="h-[52px] flex-1 rounded-xl" onClick={handleConfirm} disabled={submitting || !detail.data}>
            {submitting ? "…" : t("confirm")}
          </Button>
        </div>
      </div>
    </SheetContent>
  );
}

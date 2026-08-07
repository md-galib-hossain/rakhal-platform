"use client"; // form state + mutation

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreatePurchasedLactation, useUpdateCattleStatus } from "../hooks/use-cattle";
import { cattleStatusWithEstimatedIntakeSchema, type CattleStatusWithEstimatedIntakeInput } from "../schemas";
import type { CattleListItem } from "../types";

const UNSET = "__unset__";
const PRODUCTION_STATUSES = ["MILKING", "DRY"] as const;
const REPRODUCTIVE_STATUSES = [
  "NOT_ELIGIBLE",
  "POSTPARTUM_WAITING",
  "OPEN",
  "BRED_AWAITING_CONFIRMATION",
  "PREGNANT",
] as const;

/**
 * `PATCH /cattle/:id/status` (PRD §8.1, RAKHAL-036) — the two status dimensions this route owns.
 * Health status is derived from Healthcare and isn't settable here.
 */
export function CattleStatusDialog({
  open,
  onOpenChange,
  cattle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattle: CattleListItem | null;
}) {
  const t = useTranslations("cattle.statusDialog");
  const updateStatus = useUpdateCattleStatus();
  const createPurchasedLactation = useCreatePurchasedLactation();
  // RAKHAL-296-F: toggles between the exact `lactationStartDate` path (existing, RAKHAL-291) and
  // the estimated-intake path (`POST .../purchased-lactation`, RAKHAL-281) — a purchased cow's
  // farmer may not know a precise start date. Local UI state only (not part of the RHF form) —
  // decides which fields get validated/submitted in `onSubmit`, same pattern as the existing
  // `hasCalvedBefore` derived-from-form-state toggle just below.
  const [useEstimatedIntake, setUseEstimatedIntake] = useState(false);

  const form = useForm<CattleStatusWithEstimatedIntakeInput>({
    resolver: zodResolver(cattleStatusWithEstimatedIntakeSchema),
    values: {
      productionStatus: cattle?.productionStatus ?? undefined,
      reproductiveStatus: cattle?.reproductiveStatus ?? undefined,
      lactationStartDate: undefined,
      priorCalvings: undefined,
      estimatedCalvingDate: undefined,
      estimatedDaysInMilk: undefined,
      estimatedLactationNumber: undefined,
    },
  });

  const productionStatus = form.watch("productionStatus");
  const priorCalvings = form.watch("priorCalvings");
  // RAKHAL-291: a cow with no active lactation (`lactationStage === null`, derived server-side by
  // `composeStatus()`) needs a `lactationStartDate` supplied when it's being set to MILKING — the backend
  // uses it to create a `Lactation` row (`startReason: PURCHASE_IMPORT`) instead of hard-erroring, covering
  // e.g. a purchased cow that's already milking and never calved in this system.
  const needsLactationStartDate = productionStatus === "MILKING" && cattle?.lactationStage === null;
  // Follow-up to RAKHAL-291: `lactationStage === null` alone doesn't mean the cow is a heifer — a `COW`
  // category animal can also have no active lactation (e.g. dry between lactations). The backend's
  // heifer-guard is keyed on `totalCalvings: 0`, which the frontend doesn't have directly, but
  // `animalCategory === "HEIFER"` is derived from the same calving history server-side, so it's the
  // reliable proxy: only an actual heifer needs `priorCalvings` to unblock MILKING.
  // RAKHAL-296-F: only applies to the exact-date path — the estimated-intake endpoint deliberately
  // never touches `ReproductionProfile.totalCalvings` (documented backend scope decision), so
  // `priorCalvings` has no effect there and is hidden instead of offered.
  const needsPriorCalvings = needsLactationStartDate && !useEstimatedIntake && cattle?.animalCategory === "HEIFER";
  const hasCalvedBefore = priorCalvings !== undefined;

  async function onSubmit(values: CattleStatusWithEstimatedIntakeInput) {
    if (!cattle) return;
    if (needsLactationStartDate && useEstimatedIntake) {
      try {
        await createPurchasedLactation.mutateAsync({
          id: cattle.id,
          dto: {
            estimatedCalvingDate: values.estimatedCalvingDate || undefined,
            estimatedDaysInMilk: values.estimatedDaysInMilk,
            estimatedLactationNumber: values.estimatedLactationNumber,
          },
        });
        // Estimated-intake endpoint only flips productionStatus + creates the Lactation — a
        // reproductiveStatus change (if any) still needs its own PATCH.
        if (values.reproductiveStatus && values.reproductiveStatus !== cattle.reproductiveStatus) {
          await updateStatus.mutateAsync({
            id: cattle.id,
            dto: { reproductiveStatus: values.reproductiveStatus },
          });
        }
        toast.success(t("updatedToast"));
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t("genericError"));
      }
      return;
    }
    if (needsLactationStartDate && !values.lactationStartDate) {
      form.setError("lactationStartDate", { type: "required", message: t("lactationStartDateRequired") });
      return;
    }
    if (needsPriorCalvings && !values.priorCalvings) {
      form.setError("priorCalvings", { type: "required", message: t("priorCalvingsRequired") });
      return;
    }
    try {
      await updateStatus.mutateAsync({
        id: cattle.id,
        dto: {
          productionStatus: values.productionStatus,
          reproductiveStatus: values.reproductiveStatus,
          lactationStartDate: values.lactationStartDate,
          priorCalvings: values.priorCalvings,
        },
      });
      toast.success(t("updatedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  if (!cattle) return null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title", { name: cattle.name ?? cattle.tagNumber })}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={updateStatus.isPending || createPurchasedLactation.isPending}
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
    >
      <div className="flex flex-col gap-1.5">
        <Label>{t("productionStatus")}</Label>
        <Controller
          control={form.control}
          name="productionStatus"
          render={({ field }) => (
            <Select
              value={field.value ?? UNSET}
              onValueChange={(v) => field.onChange(v === UNSET ? undefined : v)}
            >
              <SelectTrigger aria-label={t("productionStatus")}>
                <SelectValue placeholder={t("unassigned")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>{t("unassigned")}</SelectItem>
                {PRODUCTION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`productionOptions.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("reproductiveStatus")}</Label>
        <Controller
          control={form.control}
          name="reproductiveStatus"
          render={({ field }) => (
            <Select
              value={field.value ?? UNSET}
              onValueChange={(v) => field.onChange(v === UNSET ? undefined : v)}
            >
              <SelectTrigger aria-label={t("reproductiveStatus")}>
                <SelectValue placeholder={t("unassigned")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>{t("unassigned")}</SelectItem>
                {REPRODUCTIVE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`reproductiveOptions.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      {needsLactationStartDate && (
        <>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={useEstimatedIntake}
              onCheckedChange={(v) => setUseEstimatedIntake(v === true)}
            />
            {t("useEstimatedIntake")}
          </label>
          {useEstimatedIntake ? (
            // RAKHAL-296-F — estimated-intake path (RAKHAL-281): all three fields optional, whatever
            // is left blank stays `null` server-side and the resulting Lactation is `isEstimated: true`.
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <p className="text-muted-foreground text-xs">{t("estimatedIntakeHint")}</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="estimatedCalvingDate">{t("estimatedCalvingDate")}</Label>
                <Input
                  id="estimatedCalvingDate"
                  type="date"
                  {...form.register("estimatedCalvingDate")}
                  aria-label={t("estimatedCalvingDate")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="estimatedDaysInMilk">{t("estimatedDaysInMilk")}</Label>
                <Input
                  id="estimatedDaysInMilk"
                  type="number"
                  min={0}
                  step={1}
                  {...form.register("estimatedDaysInMilk", {
                    setValueAs: (v) => (v === "" ? undefined : Number(v)),
                  })}
                  aria-label={t("estimatedDaysInMilk")}
                />
                {form.formState.errors.estimatedDaysInMilk && (
                  <p className="text-destructive text-xs">{form.formState.errors.estimatedDaysInMilk.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="estimatedLactationNumber">{t("estimatedLactationNumber")}</Label>
                <Input
                  id="estimatedLactationNumber"
                  type="number"
                  min={1}
                  step={1}
                  {...form.register("estimatedLactationNumber", {
                    setValueAs: (v) => (v === "" ? undefined : Number(v)),
                  })}
                  aria-label={t("estimatedLactationNumber")}
                />
                {form.formState.errors.estimatedLactationNumber && (
                  <p className="text-destructive text-xs">{form.formState.errors.estimatedLactationNumber.message}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>{t("lactationStartDate")}</Label>
              <Input type="date" {...form.register("lactationStartDate")} aria-label={t("lactationStartDate")} />
              <p className="text-muted-foreground text-xs">{t("lactationStartDateHint")}</p>
              {form.formState.errors.lactationStartDate && (
                <p className="text-destructive text-xs">{form.formState.errors.lactationStartDate.message}</p>
              )}
            </div>
          )}
        </>
      )}
      {needsPriorCalvings && (
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={hasCalvedBefore}
              onCheckedChange={(v) =>
                form.setValue("priorCalvings", v === true ? 1 : undefined, { shouldValidate: true })
              }
            />
            {t("hasCalvedBefore")}
          </label>
          {hasCalvedBefore && (
            <>
              <Label htmlFor="priorCalvings">{t("priorCalvings")}</Label>
              <Input
                id="priorCalvings"
                type="number"
                min={1}
                step={1}
                {...form.register("priorCalvings", { valueAsNumber: true })}
                aria-label={t("priorCalvings")}
              />
            </>
          )}
          {form.formState.errors.priorCalvings && (
            <p className="text-destructive text-xs">{form.formState.errors.priorCalvings.message}</p>
          )}
        </div>
      )}
    </FormDialog>
  );
}

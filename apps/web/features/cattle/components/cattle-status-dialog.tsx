"use client"; // form state + mutation

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
import { useUpdateCattleStatus } from "../hooks/use-cattle";
import { cattleStatusSchema, type CattleStatusInput } from "../schemas";
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

  const form = useForm<CattleStatusInput>({
    resolver: zodResolver(cattleStatusSchema),
    values: {
      productionStatus: cattle?.productionStatus ?? undefined,
      reproductiveStatus: cattle?.reproductiveStatus ?? undefined,
      lactationStartDate: undefined,
      priorCalvings: undefined,
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
  const needsPriorCalvings = needsLactationStartDate && cattle?.animalCategory === "HEIFER";
  const hasCalvedBefore = priorCalvings !== undefined;

  async function onSubmit(values: CattleStatusInput) {
    if (!cattle) return;
    if (needsLactationStartDate && !values.lactationStartDate) {
      form.setError("lactationStartDate", { type: "required", message: t("lactationStartDateRequired") });
      return;
    }
    if (needsPriorCalvings && !values.priorCalvings) {
      form.setError("priorCalvings", { type: "required", message: t("priorCalvingsRequired") });
      return;
    }
    try {
      await updateStatus.mutateAsync({ id: cattle.id, dto: values });
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
      pending={updateStatus.isPending}
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
        <div className="flex flex-col gap-1.5">
          <Label>{t("lactationStartDate")}</Label>
          <Input type="date" {...form.register("lactationStartDate")} aria-label={t("lactationStartDate")} />
          <p className="text-muted-foreground text-xs">{t("lactationStartDateHint")}</p>
          {form.formState.errors.lactationStartDate && (
            <p className="text-destructive text-xs">{form.formState.errors.lactationStartDate.message}</p>
          )}
        </div>
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

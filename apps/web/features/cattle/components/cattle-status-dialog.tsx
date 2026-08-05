"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
    },
  });

  const productionStatus = form.watch("productionStatus");
  // RAKHAL-291: a cow with no active lactation (`lactationStage === null`, derived server-side by
  // `composeStatus()`) needs a `lactationStartDate` supplied when it's being set to MILKING — the backend
  // uses it to create a `Lactation` row (`startReason: PURCHASE_IMPORT`) instead of hard-erroring, covering
  // e.g. a purchased cow that's already milking and never calved in this system.
  const needsLactationStartDate = productionStatus === "MILKING" && cattle?.lactationStage === null;

  async function onSubmit(values: CattleStatusInput) {
    if (!cattle) return;
    if (needsLactationStartDate && !values.lactationStartDate) {
      form.setError("lactationStartDate", { type: "required", message: t("lactationStartDateRequired") });
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
    </FormDialog>
  );
}

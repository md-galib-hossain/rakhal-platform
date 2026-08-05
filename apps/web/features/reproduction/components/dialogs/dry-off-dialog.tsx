"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecordDryOff } from "../../hooks/use-reproduction";
import { dryOffSchema, type CreateDryOffInput } from "../../schemas";
import type { DryOffReason } from "../../types";

const DRY_OFF_REASONS: DryOffReason[] = [
  "SCHEDULED",
  "LOW_PRODUCTION",
  "HEALTH",
  "PREGNANCY",
  "MANAGEMENT_DECISION",
];

const EMPTY_DEFAULTS: CreateDryOffInput = {
  dryOffDate: new Date().toISOString().slice(0, 10),
};

/** "Record Dry-off" (RD-038 — `DryPeriod` had no writer/no UI anywhere; RAKHAL-274 added the optional
 * `reason` field on top). Always opened from a known cow (the dashboard's "Dry-off Due" action-panel
 * row, `ReproductionActionPanels`), so — unlike the other reproduction dialogs — there's no
 * `CattlePicker`: `cattleId` is the `POST /reproduction/cattle/:id/dry-off` route param, not a form
 * field, mirroring `ProtocolInstanceActions`' `instanceId`-as-prop pattern rather than the
 * `CattlePicker`-in-body pattern the create-event dialogs use. */
export function DryOffDialog({
  cattleId,
  open,
  onOpenChange,
}: {
  cattleId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("reproduction.dialogs.dryOff");
  const recordDryOff = useRecordDryOff();
  const form = useForm<CreateDryOffInput>({
    resolver: zodResolver(dryOffSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  useEffect(() => {
    if (open) form.reset(EMPTY_DEFAULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: CreateDryOffInput) {
    if (!cattleId) return;
    try {
      await recordDryOff.mutateAsync({ cattleId, input: values });
      toast.success(t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
      title={t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={recordDryOff.isPending}
      submitLabel={t("submit")}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>{t("dryOffDate")}</Label>
          <Input type="date" {...form.register("dryOffDate")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("reason")}</Label>
          <Controller
            control={form.control}
            name="reason"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v === "" ? undefined : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("reasonPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {DRY_OFF_REASONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`reasonValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
    </FormDialog>
  );
}

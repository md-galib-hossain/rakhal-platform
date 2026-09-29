"use client";

import { todayLocalIso } from "@/lib/local-date";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { useRecordDryOff } from "../../hooks/use-reproduction";
import { dryOffSchema, type CreateDryOffInput } from "../../schemas";
import { DryOffFormFields } from "./dry-off-form-fields";

const EMPTY_DEFAULTS: CreateDryOffInput = {
  dryOffDate: todayLocalIso(),
};

/** "Record Dry-off" (RD-038 — `DryPeriod` had no writer/no UI anywhere; RAKHAL-274 added the optional
 * `reason` field on top). Always opened from a known cow (the dashboard's "Dry-off Due" action-panel
 * row, `ReproductionActionPanels`), so — unlike the other reproduction dialogs — there's no
 * `CattlePicker`: `cattleId` is the `POST /reproduction/cattle/:id/dry-off` route param, not a form
 * field, mirroring `ProtocolInstanceActions`' `instanceId`-as-prop pattern rather than the
 * `CattlePicker`-in-body pattern the create-event dialogs use.
 *
 * RAKHAL-297-F: now also surfaces the system-computed `recommendedDryOffAt` (RAKHAL-285, a
 * pregnancy-driven projection stored on the cow's active `Lactation`) as a one-click-to-apply
 * suggestion for the `dryOffDate` field, and offers a separate, lighter-weight "planned date" setter
 * (`PATCH .../planned-dry-off`) — deliberately not folded into the main submit since setting a target
 * date doesn't end the lactation the way actually recording the dry-off does. */
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
    <FormSheet
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
      <DryOffFormFields form={form} cattleId={open ? cattleId : undefined} />
    </FormSheet>
  );
}

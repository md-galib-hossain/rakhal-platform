"use client";

import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveLactation, useRecordDryOff, useUpdatePlannedDryOff } from "../../hooks/use-reproduction";
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
  const updatePlannedDryOff = useUpdatePlannedDryOff();
  const activeLactation = useActiveLactation(open ? cattleId : undefined);
  // Uncontrolled + read via ref on save, remounted (via `key` below) whenever the fetched
  // `plannedDryOffAt` changes — avoids a `setState`-in-effect cascade for what's just a
  // one-way "prefill from server" sync (this input's own edits never need to flow back out).
  const plannedDateRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateDryOffInput>({
    resolver: zodResolver(dryOffSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  useEffect(() => {
    if (open) form.reset(EMPTY_DEFAULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const recommendedDate = activeLactation.data?.recommendedDryOffAt?.slice(0, 10) ?? null;
  const plannedDateDefault = activeLactation.data?.plannedDryOffAt?.slice(0, 10) ?? "";

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

  async function handleSavePlannedDate() {
    if (!activeLactation.data) return;
    try {
      await updatePlannedDryOff.mutateAsync({
        lactationId: activeLactation.data.id,
        plannedDryOffAt: plannedDateRef.current?.value || null,
      });
      toast.success(t("plannedDateSavedToast"));
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
      {recommendedDate ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-info/40 bg-info-tint px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-info">
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            <span>{t("recommendedDate", { date: recommendedDate })}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => form.setValue("dryOffDate", recommendedDate, { shouldDirty: true })}
          >
            {t("useRecommendedDate")}
          </Button>
        </div>
      ) : null}

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

      {activeLactation.data ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <Label className="text-xs text-muted-foreground">{t("plannedDate")}</Label>
          <div className="flex items-center gap-2">
            <Input
              key={plannedDateDefault}
              ref={plannedDateRef}
              type="date"
              defaultValue={plannedDateDefault}
              className="max-w-[180px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={updatePlannedDryOff.isPending}
              onClick={handleSavePlannedDate}
            >
              {updatePlannedDryOff.isPending ? "…" : t("savePlannedDate")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("plannedDateHint")}</p>
        </div>
      ) : null}
    </FormDialog>
  );
}

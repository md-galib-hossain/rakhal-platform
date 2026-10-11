"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Can } from "@/lib/auth/permissions";
import { useEditHeatEvent, useResolveHeatEvent } from "../../hooks/use-reproduction";
import { editHeatEventSchema, type EditHeatEventFormValues, type EditHeatEventInput } from "../../schemas";
import type { HeatDetectionMethod, ReproEventEntry } from "../../types";

const DETECTION_METHODS: HeatDetectionMethod[] = ["VISUAL", "COLLAR_SENSOR", "PEDOMETER", "MANUAL"];

/** `datetime-local` value in the browser's own timezone (same shape `HeatEventDialog` uses). */
function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function defaultsFor(event?: ReproEventEntry): EditHeatEventFormValues {
  const method = event?.details.detection_method;
  return {
    cattleId: event?.cattle_id ?? "",
    heatDateTime: event ? toDateTimeLocal(event.event_date) : "",
    detectionMethod: DETECTION_METHODS.includes(method as HeatDetectionMethod) ? (method as HeatDetectionMethod) : "VISUAL",
  };
}

/**
 * "Correct heat record" — the undo for a heat recorded on the wrong animal (or with the wrong time /
 * method). Opened from a heat row in the Reproduction events feed.
 *
 * - **Save correction** → `PATCH /reproduction/heat-events/:id` (`reproduction.update`, manager+). Only the
 *   changed fields are sent, so moving the heat to the right cow is `{ cattleId }`; the backend refreshes
 *   the derived reproductive state of BOTH cows.
 * - **Mark as false alarm** → `POST .../:id/resolve` (`reproduction.heat`): closes an open heat but keeps
 *   it on the cow's history, so it is the right answer when the heat itself was not real, not when it
 *   was recorded on the wrong animal. The backend rejects an already-resolved heat; that message is shown.
 */
export function HeatEventEditDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: ReproEventEntry;
}) {
  const t = useTranslations("reproduction.dialogs.heatEdit");
  const tHeat = useTranslations("reproduction.dialogs.heat");
  const editHeat = useEditHeatEvent();
  const resolveHeat = useResolveHeatEvent();
  const form = useForm<EditHeatEventFormValues>({
    resolver: zodResolver(editHeatEventSchema),
    defaultValues: defaultsFor(event),
  });

  useEffect(() => {
    if (open) form.reset(defaultsFor(event));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  async function onSubmit(values: EditHeatEventFormValues) {
    if (!event) return;
    const original = defaultsFor(event);
    const changed: EditHeatEventInput = {};
    if (values.cattleId !== original.cattleId) changed.cattleId = values.cattleId;
    if (values.heatDateTime !== original.heatDateTime) changed.heatDateTime = new Date(values.heatDateTime).toISOString();
    if (values.detectionMethod !== original.detectionMethod) changed.detectionMethod = values.detectionMethod;
    if (Object.keys(changed).length === 0) {
      onOpenChange(false);
      return;
    }
    try {
      await editHeat.mutateAsync({ id: event.id, input: changed });
      toast.success(changed.cattleId ? t("movedToast") : t("savedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function markFalseAlarm() {
    if (!event) return;
    try {
      await resolveHeat.mutateAsync({ id: event.id, input: { reason: "FALSE_ALARM" } });
      toast.success(t("falseAlarmToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { cow: event?.cattle_name ?? event?.cattle_tag ?? "" })}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={editHeat.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2">
        <Label>{tHeat("cattle")}</Label>
        <Controller
          control={form.control}
          name="cattleId"
          render={({ field, fieldState }) => (
            <>
              <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} filters={{ gender: "FEMALE" }} />
              {fieldState.error ? <p className="text-xs text-destructive">{fieldState.error.message}</p> : null}
            </>
          )}
        />
        <p className="text-xs text-muted-foreground">{t("cowHint")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>{tHeat("heatDateTime")}</Label>
          <Controller
            control={form.control}
            name="heatDateTime"
            render={({ field, fieldState }) => (
              <DateTimePicker
                label={tHeat("heatDateTime")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{tHeat("detectionMethod")}</Label>
          <Controller
            control={form.control}
            name="detectionMethod"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DETECTION_METHODS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {tHeat(`detectionMethodValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <Can I="reproduction.heat">
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-3">
          <p className="text-sm font-medium text-foreground">{t("falseAlarmTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("falseAlarmHint")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => void markFalseAlarm()}
            disabled={resolveHeat.isPending}
          >
            {t("falseAlarm")}
          </Button>
        </div>
      </Can>
    </FormSheet>
  );
}

"use client";

import { useRef } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveLactation, useUpdatePlannedDryOff } from "../../hooks/use-reproduction";
import type { CreateDryOffInput } from "../../schemas";
import type { DryOffReason } from "../../types";

const DRY_OFF_REASONS: DryOffReason[] = [
  "SCHEDULED",
  "LOW_PRODUCTION",
  "HEALTH",
  "PREGNANCY",
  "MANAGEMENT_DECISION",
];

/** Pure-ish field markup for a dry-off form, extracted out of `dry-off-dialog.tsx` so
 * `dry-off-step.tsx` (Edit Animal's wizard step) can render the identical fields without
 * duplicating them. Not fully presentational like the other 3 extractions — it owns the
 * `useActiveLactation` fetch (for the recommended-date banner + planned-date prefill) and the
 * separate `useUpdatePlannedDryOff` mutation (a lighter-weight "target date" setter, deliberately
 * independent of the main record-dry-off submit — the dialog/step's own footer only fires the
 * main submit), since both only make sense scoped to this one field set. */
export function DryOffFormFields({
  form,
  cattleId,
}: {
  form: UseFormReturn<CreateDryOffInput>;
  cattleId?: string;
}) {
  const t = useTranslations("reproduction.dialogs.dryOff");
  const updatePlannedDryOff = useUpdatePlannedDryOff();
  const activeLactation = useActiveLactation(cattleId);
  // Uncontrolled + read via ref on save, remounted (via `key` below) whenever the fetched
  // `plannedDryOffAt` changes — avoids a `setState`-in-effect cascade for what's just a one-way
  // "prefill from server" sync (this input's own edits never need to flow back out).
  const plannedDateRef = useRef<HTMLInputElement>(null);

  const recommendedDate = activeLactation.data?.recommendedDryOffAt?.slice(0, 10) ?? null;
  const plannedDateDefault = activeLactation.data?.plannedDryOffAt?.slice(0, 10) ?? "";

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
    <>
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
    </>
  );
}

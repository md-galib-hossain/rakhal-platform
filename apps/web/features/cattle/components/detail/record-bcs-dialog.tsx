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
import { useRecordBcs } from "../../hooks/use-cattle-detail-tabs";
import { recordBcsSchema, type RecordBcsInput } from "../../schemas";
import { BCS_ALLOWED_SCORES } from "../../types";

/** `POST /cattle/:id/bcs` (RAKHAL-038, PRD §8.6) — worker-permitted (`cattle.bcs`). Score is one of
 * 17 allowed 0.25-steps (1.0–5.0), rendered as a `Select` rather than a free-typed number input so an
 * invalid value can never be submitted. */
export function RecordBcsDialog({
  cattleId,
  open,
  onOpenChange,
}: {
  cattleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("cattle.detail.performance.recordBcsDialog");
  const recordBcs = useRecordBcs(cattleId);

  const form = useForm<RecordBcsInput>({
    resolver: zodResolver(recordBcsSchema),
    defaultValues: { score: 3, date: new Date().toISOString().slice(0, 10), notes: "" },
  });

  async function onSubmit(values: RecordBcsInput) {
    try {
      await recordBcs.mutateAsync(values);
      toast.success(t("recordedToast"));
      form.reset({ score: 3, date: new Date().toISOString().slice(0, 10), notes: "" });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={recordBcs.isPending}
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
    >
      <div className="flex flex-col gap-1.5">
        <Label>{t("score")}</Label>
        <Controller
          control={form.control}
          name="score"
          render={({ field }) => (
            <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
              <SelectTrigger aria-label={t("score")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BCS_ALLOWED_SCORES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-bcs-date">{t("date")}</Label>
        <Input id="record-bcs-date" type="date" {...form.register("date")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-bcs-notes">{t("notes")}</Label>
        <Input id="record-bcs-notes" {...form.register("notes")} />
      </div>
    </FormDialog>
  );
}

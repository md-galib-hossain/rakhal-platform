"use client"; // form state + file input + mutation

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { Label } from "@rakhal/ui/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubmitFeedback } from "../hooks/use-support";
import { feedbackFormSchema, type FeedbackFormInput } from "../schemas";
import { SUPPORT_CATEGORIES } from "../types";

const DEFAULT_VALUES: FeedbackFormInput = { category: "BUG", message: "" };

/**
 * RFE-048 — Support feedback widget. Opened from the account (avatar) menu; posts to the already-
 * live `POST /feedback` (RAKHAL-242) — any authenticated farm member, no extra permission gate.
 * Screenshot is optional and handled as plain local `useState<File | null>` rather than a
 * react-hook-form field — `<input type="file">` is uncontrolled by nature and this app's other
 * file pickers (`milk-import-dialog.tsx`) follow the same pattern rather than fighting it.
 */
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("support.feedback");
  const submitFeedback = useSubmitFeedback();
  const [file, setFile] = useState<File | null>(null);

  const form = useForm<FeedbackFormInput>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function onSubmit(values: FeedbackFormInput) {
    try {
      await submitFeedback.mutateAsync({ ...values, file });
      toast.success(t("submittedToast"));
      form.reset(DEFAULT_VALUES);
      setFile(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset(DEFAULT_VALUES);
          setFile(null);
        }
        onOpenChange(next);
      }}
      title={t("title")}
      description={t("description")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={submitFeedback.isPending}
      submitLabel={t("submit")}
      cancelLabel={t("cancel")}
    >
      <div className="flex flex-col gap-1.5">
        <Label>{t("category")}</Label>
        <Controller
          control={form.control}
          name="category"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label={t("category")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`categoryOptions.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback-message">{t("message")}</Label>
        <Textarea id="feedback-message" rows={5} {...form.register("message")} />
        {form.formState.errors.message ? (
          <p className="text-xs text-destructive">{form.formState.errors.message.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback-screenshot">{t("screenshot")}</Label>
        <input
          id="feedback-screenshot"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
      </div>
    </FormSheet>
  );
}

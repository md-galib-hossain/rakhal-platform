"use client"; // form state + mutation

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@rakhal/ui/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { useReviewAnomaly } from "../hooks/use-milk";
import { reviewAnomalySchema, type ReviewAnomalyFormInput } from "../schemas";
import type { MilkAnomaly } from "../types";

/** Backend's `ReviewAnomalyDto.action` is a free-text string (no enum) — offered as quick presets
 * plus a free-text fallback, matching the DTO's real shape rather than inventing a closed enum. */
export function ReviewAnomalyDialog({
  anomaly,
  open,
  onOpenChange,
}: {
  anomaly: MilkAnomaly | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("milk.anomalies");
  const reviewAnomaly = useReviewAnomaly();

  const form = useForm<ReviewAnomalyFormInput>({
    resolver: zodResolver(reviewAnomalySchema),
    values: { action: "", notes: "" },
  });

  async function onSubmit(values: ReviewAnomalyFormInput) {
    if (!anomaly) return;
    try {
      await reviewAnomaly.mutateAsync({ id: anomaly.id, input: values });
      toast.success(t("reviewedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("reviewError"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("reviewTitle")}</SheetTitle>
          {anomaly ? (
            <SheetDescription>
              {t("reviewDescription", { name: anomaly.name ?? anomaly.tag, yield: anomaly.yieldL })}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="action">{t("actionLabel")}</Label>
            <Input
              id="action"
              placeholder={t("actionPlaceholder")}
              error={form.formState.errors.action?.message}
              {...form.register("action")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("notesLabel")}</Label>
            <Textarea id="notes" rows={3} {...form.register("notes")} />
          </div>
          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={reviewAnomaly.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={reviewAnomaly.isPending}>
              {reviewAnomaly.isPending ? t("saving") : t("markReviewed")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

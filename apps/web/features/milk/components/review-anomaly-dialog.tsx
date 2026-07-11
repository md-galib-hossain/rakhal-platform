"use client"; // form state + mutation

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("reviewTitle")}</DialogTitle>
          {anomaly ? (
            <DialogDescription>
              {t("reviewDescription", { name: anomaly.name ?? anomaly.tag, yield: anomaly.yieldL })}
            </DialogDescription>
          ) : null}
        </DialogHeader>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={reviewAnomaly.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={reviewAnomaly.isPending}>
              {reviewAnomaly.isPending ? t("saving") : t("markReviewed")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

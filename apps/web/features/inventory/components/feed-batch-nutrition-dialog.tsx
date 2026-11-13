"use client"; // form state + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@rakhal/ui/ui/sheet";
import { Button } from "@rakhal/ui/ui/button";
import { Checkbox } from "@rakhal/ui/ui/checkbox";
import { Label } from "@rakhal/ui/ui/label";
import { useReviseFeedBatchNutrition } from "../hooks/use-inventory";
import { nutritionFormSchema, type NutritionFormInput } from "../schemas";
import { profileToDraft, sameMeasured, toNutritionInput, type NutritionDraft } from "../nutrition";
import type { FeedItemBatch } from "../types";
import { NutritionFields } from "./nutrition-fields";

/**
 * Edit one lot's nutrition (ADR-026 D9, RFE-122). An edit never overwrites: the backend appends a new
 * immutable profile and repoints the lot, so the previous values stay and can be restored with "Revert".
 * `expectedUpdatedAt` guards against two people editing the same lot at once (409). The optional
 * "make default" tick also uses these values for the feed's future restocks.
 */
export function FeedBatchNutritionDialog({
  feedItemId,
  batch,
  onOpenChange,
}: {
  feedItemId: string;
  /** The lot being edited; `null` = closed. */
  batch: FeedItemBatch | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={batch != null} onOpenChange={onOpenChange}>
      {batch ? <Body key={batch.id + batch.updatedAt} feedItemId={feedItemId} batch={batch} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function Body({ feedItemId, batch, onOpenChange }: { feedItemId: string; batch: FeedItemBatch; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("inventory.feed.batchNutrition");
  const revise = useReviseFeedBatchNutrition();
  const original = profileToDraft(batch.nutrition);
  const [draft, setDraft] = useState<NutritionDraft>(original);
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof NutritionFormInput, string>>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = nutritionFormSchema.safeParse(draft);
    if (!parsed.success) {
      const required = t("required");
      const bad = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
      setErrors({
        dmPct: bad.has("dmPct") ? required : undefined,
        cpPct: bad.has("cpPct") ? required : undefined,
        meMjPerKgDm: bad.has("meMjPerKgDm") ? required : undefined,
      });
      return;
    }
    setErrors({});
    if (sameMeasured(parsed.data, original) && !makeDefault) {
      toast.info(t("noChanges"));
      return;
    }
    try {
      await revise.mutateAsync({
        id: feedItemId,
        batchId: batch.id,
        dto: { nutrition: toNutritionInput(parsed.data), expectedUpdatedAt: batch.updatedAt, makeDefault: makeDefault || undefined },
      });
      toast.success(t("savedToast"));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) toast.error(t("conflict"));
      else toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      side="right"
      className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[560px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
    >
      <SheetHeader>
        <SheetTitle>{t("title")}</SheetTitle>
        <SheetDescription>{t("description", { batch: batch.batchCode ?? t("unnamedBatch") })}</SheetDescription>
      </SheetHeader>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
          <NutritionFields value={draft} onChange={setDraft} errors={errors} idPrefix="edit-nutrition" />
          <div className="flex items-start gap-3 rounded-xl border border-border p-4">
            <Checkbox id="make-default" checked={makeDefault} onCheckedChange={(c) => setMakeDefault(c === true)} className="mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="make-default" className="cursor-pointer text-sm font-medium text-foreground">
                {t("makeDefault")}
              </Label>
              <span className="text-xs text-muted-foreground">{t("makeDefaultHint")}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("historyNote")}</p>
        </div>
        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={revise.isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={revise.isPending}>
            {revise.isPending ? "…" : t("save")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}

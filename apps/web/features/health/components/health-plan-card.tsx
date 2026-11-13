"use client"; // steps toggle + action callbacks

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Can } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/errors";
import { Chip } from "@rakhal/ui/ui/chip";
import { Button } from "@rakhal/ui/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useDeletePlan } from "../hooks/use-health";
import type { HealthPlanListItem } from "../types";

/** One "kind" per protocol (EPIC D7): the UI never shows the `category` / `planType` pair — the backend derives this from
 * `category` and returns it as `stats.kind`. */
const KIND_CHIP: Record<HealthPlanListItem["stats"]["kind"], { variant: "info" | "indigo" | "muted"; labelKey: "treatment" | "prevention" | "breeding" }> = {
  TREATMENT: { variant: "info", labelKey: "treatment" },
  PREVENTION: { variant: "indigo", labelKey: "prevention" },
  BREEDING: { variant: "muted", labelKey: "breeding" },
};

/**
 * Library template card — Figma Healthcare "Health Plan" tab (734:45281, node 734:55443). The Library is only for templates:
 * create, **apply**, **edit** and delete. It deliberately shows no progress, no "applied to" counts, no steps and no results —
 * all of that lives in the **Applied** table (`AppliedView`) and its Details sheet.
 *  1. title + condition / kind chips (and a "Deleted" flag for a protocol that was archived while animals are still on it),
 *  2. how many steps over how many days (template facts, not progress),
 *  3. **Apply** as the primary button, Edit and Delete secondary. An archived protocol cannot be applied or edited.
 */
export function HealthPlanCard({
  plan,
  onEdit,
  onApply,
}: {
  plan: HealthPlanListItem;
  onEdit: (plan: HealthPlanListItem) => void;
  onApply: (plan: HealthPlanListItem) => void;
}) {
  const t = useTranslations("health.healthPlan.card");
  const tCondition = useTranslations("health.reportSickness");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deletePlan = useDeletePlan();

  const chip = KIND_CHIP[plan.stats.kind];
  const archived = Boolean(plan.deletedAt);

  async function handleDelete() {
    try {
      await deletePlan.mutateAsync(plan.id);
      toast.success(t("deletedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h3 className="min-w-0 flex-1 basis-40 text-lg font-bold leading-snug text-foreground [overflow-wrap:anywhere]">{plan.name}</h3>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {archived ? <Chip variant="destructive">{t("deleted")}</Chip> : null}
            {plan.condition ? <Chip variant="warning">{tCondition(`conditionValue.${plan.condition}`)}</Chip> : null}
            <Chip variant={chip.variant}>{t(`type.${chip.labelKey}`)}</Chip>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <span>{t("actionSteps", { count: plan.totalActionSteps })}</span>
          <span className="size-1 rounded-full bg-muted-foreground" aria-hidden />
          <span>{t("cycleLength", { count: plan.cycleLengthDays ?? 0 })}</span>
        </div>
        {archived ? <p className="rounded-lg bg-destructive-tint px-3 py-2 text-xs text-destructive">{t("deletedHint")}</p> : null}
      </div>

      <div className="flex items-center gap-2 border-t border-dashed border-border pt-4">
        <Button type="button" className="h-11 flex-[2] text-sm" disabled={archived} onClick={() => onApply(plan)}>
          {t("apply")}
        </Button>
        <Button type="button" variant="outline" className="h-11 flex-1 text-sm" disabled={archived} onClick={() => onEdit(plan)}>
          {t("editPlan")}
        </Button>
        {!archived ? (
          <Can I="healthcare.delete">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 border-border text-destructive hover:border-destructive hover:bg-destructive/5"
              onClick={() => setDeleteOpen(true)}
              aria-label={t("deletePlan")}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </Can>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteDialog.title")}
        description={plan.stats.inProgress > 0 ? t("deleteDialog.descriptionInUse", { count: plan.stats.inProgress }) : t("deleteDialog.description")}
        confirmLabel={t("deleteDialog.confirm")}
        cancelLabel={t("deleteDialog.cancel")}
        onConfirm={handleDelete}
      />
    </div>
  );
}

"use client"; // Show More toggle + action callbacks

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Can } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/errors";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useDeletePlan } from "../hooks/use-health";
import type { HealthPlanListItem } from "../types";
import { ProtocolResultStats } from "./protocol-result-stats";

/** One "kind" per protocol (EPIC D7): the UI never shows the `category` / `planType` pair — the backend derives this from
 * `category` and returns it as `stats.kind`. */
const KIND_CHIP: Record<HealthPlanListItem["stats"]["kind"], { variant: "info" | "indigo" | "muted"; labelKey: "treatment" | "prevention" | "breeding" }> = {
  TREATMENT: { variant: "info", labelKey: "treatment" },
  PREVENTION: { variant: "indigo", labelKey: "prevention" },
  BREEDING: { variant: "muted", labelKey: "breeding" },
};

/**
 * Health Plan card — Figma "Inventory - Semen"... Healthcare "Health Plan" tab (734:45281, node
 * 734:55443 `get_design_context`): title + `planType` chip, "{N} Action Steps • {M} Days Cycle
 * Length", a collapsible day-by-day Action Sequence (3 rows shown, "Show More" reveals the rest —
 * real `steps` come back on `GET /health/plans` itself, verified live, no separate detail fetch),
 * Edit Plan + Apply buttons. **RFE-136**: the result band the mock pictures ("N Animals" / "X% Success Rate") is now
 * real — `stats` on `GET /health/plans` (RAKHAL-466) is computed from the cases / enrollments that used the protocol —
 * and a protocol tagged with a condition (RAKHAL-468) shows it as a chip next to its kind.
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
  const [expanded, setExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deletePlan = useDeletePlan();

  const chip = KIND_CHIP[plan.stats.kind];
  const visibleSteps = expanded ? plan.steps : plan.steps.slice(0, 3);
  const hasMore = plan.steps.length > 3;

  async function handleDelete() {
    try {
      await deletePlan.mutateAsync(plan.id);
      toast.success(t("deletedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <p className="flex-1 truncate text-xl font-bold text-foreground">{plan.name}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {plan.condition ? <Chip variant="warning">{tCondition(`conditionValue.${plan.condition}`)}</Chip> : null}
            <Chip variant={chip.variant}>{t(`type.${chip.labelKey}`)}</Chip>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>{t("actionSteps", { count: plan.totalActionSteps })}</span>
          <span className="size-1 rounded-full bg-muted-foreground" />
          <span>{t("cycleLength", { count: plan.cycleLengthDays ?? 0 })}</span>
        </div>
        <ProtocolResultStats stats={plan.stats} />
      </div>

      <div className="border-t border-dashed border-border" />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{t("actionSequence")}</p>
          <div className="flex flex-col gap-3">
            {visibleSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2.5 text-xs">
                <span className="w-10 shrink-0 text-muted-foreground">{t("day", { day: step.dayNumber })}</span>
                <span className="text-muted-foreground">-</span>
                <span className="flex-1 truncate text-foreground">{step.instruction || step.title}</span>
              </div>
            ))}
          </div>
        </div>
        {hasMore ? (
          <button type="button" className="flex items-center gap-1.5 text-xs font-medium text-primary" onClick={() => setExpanded((v) => !v)}>
            {expanded ? t("showLess") : t("showMore")}
            <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1 text-sm" onClick={() => onEdit(plan)}>
          {t("editPlan")}
        </Button>
        <Button type="button" className="h-11 flex-1 text-sm" onClick={() => onApply(plan)}>
          {t("apply")}
        </Button>
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
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteDialog.title")}
        description={t("deleteDialog.description")}
        confirmLabel={t("deleteDialog.confirm")}
        cancelLabel={t("deleteDialog.cancel")}
        onConfirm={handleDelete}
      />
    </div>
  );
}

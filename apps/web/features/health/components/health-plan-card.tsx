"use client"; // Show More toggle + action callbacks

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import type { HealthPlanListItem } from "../types";

const PLAN_TYPE_CHIP: Record<HealthPlanListItem["planType"], { variant: "info" | "indigo" | "muted"; labelKey: "medical" | "prevention" | "breeding" | "general" }> = {
  MEDICAL: { variant: "info", labelKey: "medical" },
  PREVENTION: { variant: "indigo", labelKey: "prevention" },
  BREEDING: { variant: "muted", labelKey: "breeding" },
  GENERAL: { variant: "muted", labelKey: "general" },
};

/**
 * Health Plan card — Figma "Inventory - Semen"... Healthcare "Health Plan" tab (734:45281, node
 * 734:55443 `get_design_context`): title + `planType` chip, "{N} Action Steps • {M} Days Cycle
 * Length", a collapsible day-by-day Action Sequence (3 rows shown, "Show More" reveals the rest —
 * real `steps` come back on `GET /health/plans` itself, verified live, no separate detail fetch),
 * Edit Plan + Apply buttons. **Real gap vs the mock, flagged not faked**: the footer stat band
 * ("Currently Active" / "N Animals" / "X% Success Rate") has no backing data anywhere in this
 * schema — `HealthPlan` tracks no active-enrollment count or outcome-success metric, and there's no
 * `healthPlanId` filter on the cases list to derive one client-side either — dropped entirely rather
 * than invented, same call `MilkStatsCard` made for its own unbacked KPI row.
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
  const [expanded, setExpanded] = useState(false);
  const chip = PLAN_TYPE_CHIP[plan.planType];
  const visibleSteps = expanded ? plan.steps : plan.steps.slice(0, 3);
  const hasMore = plan.steps.length > 3;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <p className="flex-1 truncate text-xl font-bold text-foreground">{plan.name}</p>
          <Chip variant={chip.variant}>{t(`type.${chip.labelKey}`)}</Chip>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>{t("actionSteps", { count: plan.totalActionSteps })}</span>
          <span className="size-1 rounded-full bg-muted-foreground" />
          <span>{t("cycleLength", { count: plan.cycleLengthDays ?? 0 })}</span>
        </div>
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
      </div>
    </div>
  );
}

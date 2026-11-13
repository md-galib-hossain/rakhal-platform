"use client"; // owns the selection, start date and pending state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { todayLocalIso } from "@/lib/local-date";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Chip } from "@rakhal/ui/ui/chip";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { useApplyPlanToCase, useHealthPlans } from "../hooks/use-health";
import { suggestProtocols } from "../protocol-preview";
import type { HealthCondition } from "../types";
import { ProtocolPreviewSummary } from "./protocol-preview-timeline";

/** Pick a treatment protocol and start it on an existing case (`POST /health/cases/:id/apply-plan`). Shared by the
 * Report Sickness next-step card (RFE-133) and the case Overview "what next" card (RFE-135). Treatment protocols
 * only: a sick animal's case takes a curative plan (preventive plans make rounds, not cases). Reuses the
 * `health.reportSickness.nextStep.*` strings. */
export function ProtocolPicker({
  caseId,
  caseIds,
  condition,
  onApplied,
}: {
  /** One case. Give `caseIds` instead to start the same protocol on several (RFE-139, an outbreak's new cases). */
  caseId?: string;
  caseIds?: string[];
  /** The case's structured condition (RFE-136): protocols tagged with it are listed first and marked "Suggested". */
  condition?: HealthCondition | null;
  onApplied: (planName: string) => void;
}) {
  const t = useTranslations("health.reportSickness.nextStep");
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const [startDate, setStartDate] = useState(todayLocalIso);
  const plans = useHealthPlans({ category: "TREATMENT" });
  const apply = useApplyPlanToCase();
  const [busy, setBusy] = useState(false);
  const suggested = suggestProtocols(plans.data?.items ?? [], condition);
  const items = suggested.map((s) => s.plan);
  const selectedPlan = items.find((p) => p.id === planId);

  const targets = caseIds ?? (caseId ? [caseId] : []);
  const pending = busy || apply.isPending;

  async function handleApply() {
    if (!planId || targets.length === 0) return;
    // One call per case (the apply route is per case). A failure part-way leaves the earlier ones started, so say
    // how many made it rather than pretending it was all or nothing.
    let done = 0;
    let lastError: unknown = null;
    setBusy(true);
    for (const target of targets) {
      try {
        await apply.mutateAsync({ caseId: target, dto: { healthPlanId: planId, startDate } });
        done += 1;
      } catch (err) {
        lastError = err;
      }
    }
    setBusy(false);
    if (done === targets.length) {
      toast.success(targets.length === 1 ? t("appliedToast") : t("appliedToastMany", { count: done }));
    } else if (done > 0) {
      toast.error(t("applyPartial", { done, total: targets.length }));
    } else {
      toast.error(lastError instanceof ApiError ? lastError.message : t("applyError"));
    }
    if (done > 0) onApplied(items.find((p) => p.id === planId)?.name ?? "");
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
      {plans.isLoading ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noProtocols")}</p>
      ) : (
        <div role="radiogroup" aria-label={t("pickProtocol")} className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {suggested.map(({ plan, matches }) => {
            const selected = plan.id === planId;
            const { recoveryRate } = plan.stats;
            return (
              <button
                key={plan.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPlanId(plan.id)}
                className={cn(
                  "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  selected ? "border-primary bg-primary/10" : "border-border hover:border-foreground/30",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{plan.name}</span>
                  {matches ? (
                    <Chip variant="primary" subtle className="shrink-0">
                      {t("suggested")}
                    </Chip>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("planMeta", { steps: plan.totalActionSteps, days: plan.cycleLengthDays ?? 0 })}
                  {recoveryRate != null ? ` · ${t("recoveryMeta", { rate: Math.round(recoveryRate) })}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {items.length > 0 ? (
        <>
          <DatePicker label={t("startDate")} value={startDate} onChange={setStartDate} disabled={pending} />
          {selectedPlan ? <ProtocolPreviewSummary steps={selectedPlan.steps} startDate={startDate} /> : null}
          <Button type="button" onClick={() => void handleApply()} disabled={!planId || pending} className="h-11">
            {pending ? "…" : t("applyProtocol")}
          </Button>
        </>
      ) : null}
    </div>
  );
}

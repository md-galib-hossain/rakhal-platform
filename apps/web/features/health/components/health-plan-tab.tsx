"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealthPlans } from "../hooks/use-health";
import { HealthPlanCard } from "./health-plan-card";
import { CreateHealthPlanDialog } from "./create-health-plan-dialog";
import { ApplyHealthPlanDialog } from "./apply-health-plan-dialog";
import type { HealthPlanListItem } from "../types";

/**
 * "Protocols" tab (RFE-107 rename; was "Health Plan") — Figma 734:45281 (list) +
 * "Create New Health Plan" 3-step wizard (734:47059/47993/48743) + "Apply Health Plan Template"
 * 2-step wizard (734:49979/50881), `get_design_context`. Real `GET /health/plans` data throughout
 * (see `health-plan-card.tsx` for the one KPI-band gap flagged, not faked). **RFE-107**: the
 * "Active Plans" section that used to render below the plan catalog is gone — preventive rounds
 * now live in `TreatmentsTab`'s own section, curative protocol-attached cases in its Sick Bay
 * table; this tab is the plan catalog only.
 */
export function HealthPlanTab() {
  const t = useTranslations("health.healthPlan");
  const [search, setSearch] = useState("");
  const query = useHealthPlans({ search: search || undefined });
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<HealthPlanListItem | undefined>(undefined);
  const [applyingPlan, setApplyingPlan] = useState<HealthPlanListItem | undefined>(undefined);

  const plans = query.data?.items ?? [];

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[320px] w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  if (query.isError) return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" />
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingPlan(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {t("createNewPlan")}
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditingPlan(undefined);
                setFormOpen(true);
              }}
            >
              {t("createNewPlan")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {plans.map((plan) => (
            <HealthPlanCard
              key={plan.id}
              plan={plan}
              onEdit={(p) => {
                setEditingPlan(p);
                setFormOpen(true);
              }}
              onApply={setApplyingPlan}
            />
          ))}
        </div>
      )}

      <CreateHealthPlanDialog open={formOpen} onOpenChange={setFormOpen} plan={editingPlan} />
      <ApplyHealthPlanDialog plan={applyingPlan} onOpenChange={(open) => !open && setApplyingPlan(undefined)} />
    </div>
  );
}

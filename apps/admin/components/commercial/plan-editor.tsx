"use client";

import { useActionState } from "react";
import { Button } from "@rakhal/ui/ui/button";
import { ActionDialog } from "@/components/directory/action-dialog";
import { togglePlanFeatureAction, updatePlanAction } from "@/lib/actions/commercial";
import { initialActionState } from "@/lib/actions/support-state";

const field = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

export interface PlanView {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  maxCattle: number | null;
  maxFarmMembers: number | null;
  farmCount: number;
  enabledFeatures: string[];
}

function Num({ id, label, current, error }: { id: string; label: string; current: number | null; error?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input id={id} name={id} inputMode="decimal" placeholder={current === null ? "none" : String(current)} className={field} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/** Edit a plan's price and limits. Blank fields stay unchanged; the change applies to every farm on the plan. */
export function PlanForm({ plan }: { plan: PlanView }) {
  const [state, action, pending] = useActionState(updatePlanAction.bind(null, plan.id), initialActionState);
  return (
    <form action={action} className="space-y-3">
      {state.message ? (
        <p role={state.ok ? "status" : "alert"} className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-success-tint" : "bg-destructive-tint text-destructive"}`}>
          {state.message}
        </p>
      ) : null}
      {state.errors?.form ? <p className="text-xs text-destructive">{state.errors.form}</p> : null}
      <p className="text-xs text-muted-foreground">
        Leave a field blank to keep it. Applies to {plan.farmCount} farm{plan.farmCount === 1 ? "" : "s"} on this plan.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Num id="monthlyPrice" label="Monthly price (BDT)" current={plan.monthlyPrice} error={state.errors?.monthlyPrice} />
        <Num id="yearlyPrice" label="Yearly price (BDT)" current={plan.yearlyPrice} error={state.errors?.yearlyPrice} />
        <Num id="maxCattle" label="Max cattle" current={plan.maxCattle} error={state.errors?.maxCattle} />
        <Num id="maxFarmMembers" label="Max members" current={plan.maxFarmMembers} error={state.errors?.maxFarmMembers} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`reason-${plan.id}`} className="text-sm font-medium">
          Reason (kept in the audit log)
        </label>
        <input id={`reason-${plan.id}`} name="reason" required minLength={10} className={field} />
        {state.errors?.reason ? <p className="text-xs text-destructive">{state.errors.reason}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save plan"}
      </Button>
    </form>
  );
}

/** One cell of the feature matrix: a confirm-to-toggle button. */
export function FeatureToggle({ planId, featureKey, enabled }: { planId: string; featureKey: string; enabled: boolean }) {
  return (
    <ActionDialog
      key={`${planId}-${featureKey}-${enabled}`}
      action={togglePlanFeatureAction.bind(null, planId, featureKey, !enabled)}
      triggerLabel={enabled ? "On" : "Off"}
      title={enabled ? "Remove this feature from the plan?" : "Add this feature to the plan?"}
      description={
        enabled
          ? "Every farm on this plan loses the feature on its next request."
          : "Every farm on this plan gains the feature on its next request."
      }
      confirmValue={featureKey}
      confirmNoun="feature key"
      submitLabel={enabled ? "Remove feature" : "Add feature"}
    />
  );
}

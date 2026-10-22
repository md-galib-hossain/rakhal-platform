"use client";

import { subscriptionAction } from "@/lib/actions/commercial";
import { ActionDialog } from "@/components/directory/action-dialog";

const field = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

function PlanSelect({ plans }: { plans: { id: string; name: string }[] }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="sub-plan" className="text-sm font-medium">
        Plan
      </label>
      <select id="sub-plan" name="planId" required defaultValue="" className={field}>
        <option value="" disabled>
          Choose a plan
        </option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function DaysInput({ max = 365 }: { max?: number }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="sub-days" className="text-sm font-medium">
        Days (1-{max})
      </label>
      <input id="sub-days" name="days" type="number" min={1} max={max} step={1} required className={field} />
    </div>
  );
}

/**
 * Manual subscription operations. No invoice or payment is created: these are commercial decisions, recorded
 * in the audit log as manual. Hidden without `subscription.manage`; the backend enforces it regardless.
 */
export function SubscriptionActions({
  farmId,
  farmName,
  plans,
  canManage,
}: {
  farmId: string;
  farmName: string;
  plans: { id: string; name: string }[];
  canManage: boolean;
}) {
  if (!canManage) return null;
  const common = { confirmValue: farmName, confirmNoun: "farm name" } as const;

  return (
    <div className="flex flex-wrap gap-2">
      <ActionDialog
        {...common}
        action={subscriptionAction.bind(null, "activate", farmId)}
        triggerLabel="Activate plan"
        title="Activate a plan manually?"
        description="Starts the chosen plan now for one billing period (extends from the current expiry when renewing the same plan). No invoice is created."
        submitLabel="Activate plan"
      >
        <PlanSelect plans={plans} />
        <div className="space-y-1.5">
          <label htmlFor="sub-period" className="text-sm font-medium">
            Billing period
          </label>
          <select id="sub-period" name="period" required defaultValue="MONTHLY" className={field}>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>
      </ActionDialog>

      <ActionDialog
        {...common}
        action={subscriptionAction.bind(null, "comp", farmId)}
        triggerLabel="Comp plan"
        title="Give free access (comp)?"
        description="Grants the chosen plan at no charge for a fixed number of days. No invoice is created."
        submitLabel="Grant free access"
      >
        <PlanSelect plans={plans} />
        <DaysInput />
      </ActionDialog>

      <ActionDialog
        {...common}
        action={subscriptionAction.bind(null, "extend", farmId)}
        triggerLabel="Extend"
        title="Extend the subscription?"
        description="Adds days to the current subscription (from today if it has already ended, which also reactivates it)."
        submitLabel="Extend subscription"
      >
        <DaysInput />
      </ActionDialog>

      <ActionDialog
        {...common}
        action={subscriptionAction.bind(null, "cancel", farmId)}
        triggerLabel="Cancel subscription"
        title="Cancel this subscription?"
        description="Cancels it immediately. The farm loses paid access; you can activate a plan again later."
        submitLabel="Cancel subscription"
        danger
      />
    </div>
  );
}

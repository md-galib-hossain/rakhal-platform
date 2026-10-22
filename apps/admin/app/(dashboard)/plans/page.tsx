import { PageHeader } from "@rakhal/ui/shared/page-header";
import { FeatureToggle, PlanForm } from "@/components/commercial/plan-editor";
import { DetailSection, TableShell, pageSurface, td, th } from "@/components/directory/detail-list";
import { StatusBadge } from "@/components/directory/status-badge";
import { getPlanMatrix } from "@/lib/api/directory";
import { PermissionGate } from "@/lib/auth/permission-gate";
import { getSession } from "@/lib/auth/session";
import { formatCount } from "@/lib/format";
import { canDo } from "@/lib/permissions";

export default function PlansPage() {
  return (
    <PermissionGate perm="plan.read">
      <PlansBody />
    </PermissionGate>
  );
}

async function PlansBody() {
  const [matrix, session] = await Promise.all([getPlanMatrix(), getSession()]);
  const canManage = canDo(session?.permissions ?? [], "plan.manage");

  return (
    <div className={pageSurface}>
      <PageHeader
        title="Plans"
        description="Prices, limits and the feature matrix. A change applies to every farm on the plan on its next request, and is recorded with your reason in the audit log."
      />

      {matrix.plans.map((plan) => (
        <DetailSection key={plan.id} title={`${plan.name} - ${formatCount(plan.farmCount)} farm${plan.farmCount === 1 ? "" : "s"}`}>
          <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Monthly</dt>
              <dd>BDT {formatCount(plan.monthlyPrice)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Yearly</dt>
              <dd>{plan.yearlyPrice === null ? "-" : `BDT ${formatCount(plan.yearlyPrice)}`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Max cattle</dt>
              <dd>{plan.maxCattle === null ? "Unlimited" : formatCount(plan.maxCattle)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Max members</dt>
              <dd>{plan.maxFarmMembers === null ? "Unlimited" : formatCount(plan.maxFarmMembers)}</dd>
            </div>
          </dl>

          <TableShell caption={`Features of ${plan.name}`}>
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className={th}>Feature</th>
                <th className={th}>{canManage ? "Included (click to change)" : "Included"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {matrix.features.map((feature) => {
                const enabled = plan.enabledFeatures.includes(feature.key);
                return (
                  <tr key={feature.id}>
                    <td className={td}>
                      <p className="font-medium">{feature.key}</p>
                      {feature.description ? <p className="text-xs text-muted-foreground">{feature.description}</p> : null}
                    </td>
                    <td className={td}>
                      {canManage ? (
                        <FeatureToggle planId={plan.id} featureKey={feature.key} enabled={enabled} />
                      ) : (
                        <StatusBadge status={enabled ? "ON" : "OFF"} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>

          {canManage ? (
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-semibold">Edit price and limits</h3>
              <PlanForm plan={plan} />
            </div>
          ) : null}
        </DetailSection>
      ))}
    </div>
  );
}

import Link from "next/link";
import { PageHeader } from "@rakhal/ui/shared/page-header";
import { DetailList, DetailSection, pageSurface, TableShell, td, th } from "@/components/directory/detail-list";
import { StatusBadge } from "@/components/directory/status-badge";
import { getFarm, getPlanMatrix, type SubscriptionSummary } from "@/lib/api/directory";
import { SubscriptionActions } from "@/components/commercial/subscription-actions";
import { FarmActions } from "@/components/directory/farm-actions";
import { PermissionGate } from "@/lib/auth/permission-gate";
import { getSession } from "@/lib/auth/session";
import { canDo } from "@/lib/permissions";
import { formatDate, formatDateTime, formatLocation, TIME_ZONE_LABEL } from "@/lib/format";

export default function FarmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PermissionGate perm="farm.read">
      <FarmDetail params={params} />
    </PermissionGate>
  );
}

function SubscriptionLine({ sub }: { sub: SubscriptionSummary }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span>
        <span className="font-medium">{sub.subscriptionPlan.name}</span>{" "}
        <span className="text-muted-foreground">
          from {formatDate(sub.startsAt)}
          {sub.expiresAt ? ` until ${formatDate(sub.expiresAt)}` : ""}
        </span>
        {sub.pendingPlan ? <span className="text-muted-foreground"> - switching to {sub.pendingPlan.name}</span> : null}
      </span>
      <StatusBadge status={sub.status} />
    </li>
  );
}

async function FarmDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [farm, session] = await Promise.all([getFarm(id), getSession()]);
  const canManage = canDo(session?.permissions ?? [], "farm.manage");
  const canManageSubscription = canDo(session?.permissions ?? [], "subscription.manage");
  // Only fetch the plan list when the admin can act on it.
  const plans = canManageSubscription ? (await getPlanMatrix()).plans.map((p) => ({ id: p.id, name: p.name })) : [];

  return (
    <div className={pageSurface}>
      <PageHeader
        title={farm.name}
        description={farm.farmCode ?? farm.slug}
        breadcrumbs={[{ label: "Farms", href: "/farms" }, { label: farm.name }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={farm.status} />
            <FarmActions farmId={farm.id} farmName={farm.name} status={farm.status} canManage={canManage} />
          </div>
        }
      />

      {farm.status === "SUSPENDED" ? (
        <p role="status" className="rounded-md bg-warning-tint px-3 py-2 text-sm text-foreground">
          This farm is suspended: its members are refused access until it is reactivated.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailSection title="Profile">
          <DetailList
            items={[
              { label: "Location", value: formatLocation(farm.upazila, farm.district, farm.division) },
              { label: "Phone", value: farm.phone },
              { label: "Address", value: farm.address },
              { label: "Herd size", value: farm.herdSizeBand },
              { label: "Purpose", value: farm.operationalPurpose },
              { label: "Time zone", value: farm.timezone },
              { label: "Cattle records", value: farm.cattleRecords },
              { label: "Onboarding", value: farm.hasCompletedOnboarding ? "Completed" : "Not completed" },
              { label: `Created (${TIME_ZONE_LABEL})`, value: formatDateTime(farm.createdAt) },
              { label: "Last member activity", value: formatDateTime(farm.lastActivityAt) },
            ]}
          />
        </DetailSection>

        <DetailSection title="Owner">
          <DetailList
            items={[
              {
                label: "Name",
                value: (
                  <Link href={`/users/${farm.owner.id}`} className="underline underline-offset-2">
                    {farm.owner.name}
                  </Link>
                ),
              },
              { label: "Email", value: farm.owner.email },
              { label: "Email verified", value: farm.owner.isEmailVerified ? "Yes" : "No" },
              { label: "Account", value: farm.owner.isBlocked ? <StatusBadge status="BLOCKED" /> : "In good standing" },
              { label: "Last sign-in", value: formatDateTime(farm.owner.lastLoginAt) },
            ]}
          />
        </DetailSection>
      </div>

      <DetailSection title="Subscription">
        {canManageSubscription ? (
          <div className="mb-3">
            <SubscriptionActions farmId={farm.id} farmName={farm.name} plans={plans} canManage />
          </div>
        ) : null}
        {farm.subscriptionHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscription on record.</p>
        ) : (
          <ul className="divide-y divide-border">
            {farm.subscriptionHistory.map((sub, i) => (
              <SubscriptionLine key={`${sub.startsAt}-${i}`} sub={sub} />
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection title={`Members (${farm.members.length})`}>
        <TableShell caption="Farm members">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Role</th>
              <th className={th}>Joined</th>
              <th className={th}>Last sign-in</th>
              <th className={th}>Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {farm.members.map((m) => (
              <tr key={m.id}>
                <td className={td}>
                  <Link href={`/users/${m.id}`} className="font-medium underline-offset-2 hover:underline">
                    {m.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </td>
                <td className={td}>{m.role}</td>
                <td className={td}>{formatDate(m.joinedAt)}</td>
                <td className={td}>{formatDateTime(m.lastLoginAt)}</td>
                <td className={td}>{m.isBlocked ? <StatusBadge status="BLOCKED" /> : "OK"}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </DetailSection>
    </div>
  );
}

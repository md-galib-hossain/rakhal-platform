import Link from "next/link";
import { PageHeader } from "@rakhal/ui/shared/page-header";
import { DetailList, DetailSection, pageSurface, TableShell, td, th } from "@/components/directory/detail-list";
import { StatusBadge } from "@/components/directory/status-badge";
import { getUser } from "@/lib/api/directory";
import { UserActions } from "@/components/directory/user-actions";
import { PermissionGate } from "@/lib/auth/permission-gate";
import { getSession } from "@/lib/auth/session";
import { canDo } from "@/lib/permissions";
import { formatDate, formatDateTime, TIME_ZONE_LABEL } from "@/lib/format";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PermissionGate perm="user.read">
      <UserDetail params={params} />
    </PermissionGate>
  );
}

async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, session] = await Promise.all([getUser(id), getSession()]);
  const locked = !!user.lockedUntil && new Date(user.lockedUntil) > new Date();
  const canManage = canDo(session?.permissions ?? [], "user.manage");

  return (
    <div className={pageSurface}>
      <PageHeader
        title={user.name}
        description={user.email}
        breadcrumbs={[{ label: "Users", href: "/users" }, { label: user.name }]}
        actions={user.isBlocked ? <StatusBadge status="BLOCKED" /> : undefined}
      />

      <UserActions userId={user.id} email={user.email} isBlocked={user.isBlocked} canManage={canManage} />

      {user.isBlocked ? (
        <p role="status" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-foreground">
          This user is blocked: they are signed out and cannot sign in until unblocked.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailSection title="Account">
          <DetailList
            items={[
              { label: "Email verified", value: user.isEmailVerified ? (user.emailVerifiedAt ? `Yes (${formatDate(user.emailVerifiedAt)})` : "Yes") : "No" },
              { label: "Blocked", value: user.isBlocked ? "Yes" : "No" },
              { label: "Temporarily locked", value: locked ? `Until ${formatDateTime(user.lockedUntil)}` : "No" },
              { label: "Two-factor", value: user.mfaConfigured ? "Configured" : "Not configured" },
              { label: "Language", value: user.preferredLanguage },
              { label: `Joined (${TIME_ZONE_LABEL})`, value: formatDateTime(user.createdAt) },
            ]}
          />
        </DetailSection>

        <DetailSection title="Sign-in activity">
          <DetailList
            items={[
              { label: "Last sign-in", value: formatDateTime(user.lastLoginAt) },
              { label: "Active sessions", value: user.activeSessionCount },
              { label: "Failed attempts (streak)", value: user.failedLoginAttempts },
              { label: "Last failed attempt", value: formatDateTime(user.lastFailedLoginAt) },
              { label: "Password last changed", value: formatDateTime(user.lastPasswordChangedAt) },
              { label: "Farms owned", value: user.ownedFarmCount },
            ]}
          />
        </DetailSection>
      </div>

      <DetailSection title={`Farm memberships (${user.memberships.length})`}>
        {user.memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not a member of any farm.</p>
        ) : (
          <TableShell caption="Farm memberships">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className={th}>Farm</th>
                <th className={th}>Role</th>
                <th className={th}>Farm status</th>
                <th className={th}>Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {user.memberships.map((m) => (
                <tr key={m.farm.id}>
                  <td className={td}>
                    <Link href={`/farms/${m.farm.id}`} className="font-medium underline-offset-2 hover:underline">
                      {m.farm.name}
                    </Link>
                  </td>
                  <td className={td}>{m.role}</td>
                  <td className={td}>
                    <StatusBadge status={m.farm.status} />
                  </td>
                  <td className={td}>{formatDate(m.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </DetailSection>
    </div>
  );
}

import Link from "next/link";
import { PageHeader } from "@rakhal/ui/shared/page-header";
import { DetailSection, TableShell, pageSurface, td, th } from "@/components/directory/detail-list";
import { StatusBadge } from "@/components/directory/status-badge";
import { Tile } from "@/components/insights/charts";
import { getSecurity } from "@/lib/api/directory";
import { PermissionGate } from "@/lib/auth/permission-gate";
import { describeAgent, formatCount, formatDateTime, TIME_ZONE_LABEL } from "@/lib/format";

export default function SecurityPage() {
  return (
    <PermissionGate perm="security.read">
      <SecurityBody />
    </PermissionGate>
  );
}

function accountState(u: { isBlocked: boolean; lockedUntil: string | null }) {
  if (u.isBlocked) return <StatusBadge status="BLOCKED" />;
  if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) return <StatusBadge status="SUSPENDED" />;
  return <span className="text-muted-foreground">OK</span>;
}

function UserLink({ id, name, email }: { id: string; name: string; email: string }) {
  return (
    <>
      <Link href={`/users/${id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
        {name}
      </Link>
      <p className="text-xs text-muted-foreground">{email}</p>
    </>
  );
}

async function SecurityBody() {
  const s = await getSecurity();
  const c = s.counts;

  return (
    <div className={pageSurface}>
      <PageHeader
        title="Security"
        description={`Sign-ins, failed attempts and locked accounts as of ${formatDateTime(s.generatedAt)} (${TIME_ZONE_LABEL}). Open a user to revoke sessions or block the account.`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Active sessions" value={formatCount(c.activeSessions)} hint="Signed in and not expired" />
        <Tile label="Sign-ins, 24 hours" value={formatCount(c.signIns24h)} hint={`${formatCount(c.signIns7d)} in the last 7 days`} />
        <Tile label="Failed attempts, 24 hours" value={formatCount(c.usersWithFailedAttempts24h)} hint="Users with a wrong password" />
        <Tile label="Locked or blocked" value={formatCount(c.lockedNow + c.blocked)} hint={`${formatCount(c.lockedNow)} locked out now, ${formatCount(c.blocked)} blocked`} />
      </div>

      <DetailSection title="Needs attention">
        {s.needsAttention.length === 0 ? (
          <p className="text-sm text-muted-foreground">No account has repeated failed sign-ins or is locked out.</p>
        ) : (
          <TableShell caption="Accounts with repeated failed sign-ins or locked out">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className={th}>User</th>
                <th className={th}>Failed attempts</th>
                <th className={th}>Last failure</th>
                <th className={th}>Locked until</th>
                <th className={th}>Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {s.needsAttention.map((u) => (
                <tr key={u.id}>
                  <td className={td}>
                    <UserLink {...u} />
                  </td>
                  <td className={`${td} tabular-nums`}>{u.failedLoginAttempts}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(u.lastFailedLoginAt)}</td>
                  <td className={`${td} whitespace-nowrap`}>{u.lockedUntil && new Date(u.lockedUntil) > new Date() ? formatDateTime(u.lockedUntil) : "-"}</td>
                  <td className={td}>{accountState(u)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Three or more failed password attempts in the current streak, or locked out right now.</p>
      </DetailSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailSection title="Many locations in 24 hours">
          {s.multiLocation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No user signed in from three or more addresses.</p>
          ) : (
            <ul className="divide-y divide-border">
              {s.multiLocation.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <UserLink {...m} />
                  </span>
                  <span className="shrink-0 tabular-nums">{m.distinctIps} addresses</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">A shared or stolen password often shows up as one account on many networks.</p>
        </DetailSection>

        <DetailSection title="Admin panel failed sign-ins">
          {s.adminFailedLogins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No failed admin sign-ins recorded.</p>
          ) : (
            <ul className="divide-y divide-border">
              {s.adminFailedLogins.map((f) => (
                <li key={f.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {f.actorEmail ?? "unknown email"}
                    <span className="ml-2 text-xs text-muted-foreground">{f.ipAddress ?? "no address"}</span>
                  </span>
                  <time dateTime={f.createdAt} className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(f.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {formatCount(c.adminFailedLogins24h)} in the last 24 hours. Full trail in the{" "}
            <Link href="/audit?search=LOGIN_FAILED" className="underline underline-offset-2">
              audit log
            </Link>
            .
          </p>
        </DetailSection>
      </div>

      <DetailSection title="Recent sign-ins">
        {s.recentSignIns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sign-ins yet.</p>
        ) : (
          <TableShell caption="Most recent user sign-ins">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className={th}>User</th>
                <th className={th}>Signed in</th>
                <th className={th}>Device</th>
                <th className={th}>Address</th>
                <th className={th}>Last used</th>
                <th className={th}>Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {s.recentSignIns.map((r) => (
                <tr key={r.id}>
                  <td className={td}>
                    <UserLink {...r.user} />
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.createdAt)}</td>
                  <td className={td} title={r.userAgent ?? undefined}>
                    {describeAgent(r.userAgent, r.deviceName)}
                  </td>
                  <td className={`${td} font-mono text-xs`}>{r.ipAddress ?? "-"}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.lastUsedAt)}</td>
                  <td className={td}>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        <p className="mt-2 text-xs text-muted-foreground">One row per sign-in, newest first. Addresses are personal data; do not share this page.</p>
      </DetailSection>
    </div>
  );
}

import Link from "next/link";
import { PageHeader } from "@rakhal/ui/shared/page-header";
import { DetailSection, TableShell, pageSurface, td, th } from "@/components/directory/detail-list";
import { StatusBadge } from "@/components/directory/status-badge";
import { getUsage } from "@/lib/api/directory";
import { PermissionGate } from "@/lib/auth/permission-gate";
import { getSession } from "@/lib/auth/session";
import { formatCount, formatDateTime, humanizeEnum, TIME_ZONE_LABEL } from "@/lib/format";
import { canDo } from "@/lib/permissions";

export default function AnalyticsPage() {
  return (
    <PermissionGate perm="analytics.read">
      <AnalyticsBody />
    </PermissionGate>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

async function AnalyticsBody() {
  const [u, session] = await Promise.all([getUsage(), getSession()]);
  const perms = session?.permissions ?? [];
  const exports = [
    { kind: "farms", label: "Farms", perm: "export.farms" },
    { kind: "subscriptions", label: "Subscriptions", perm: "export.farms" },
    { kind: "users", label: "Users (personal data)", perm: "export.users" },
  ].filter((e) => canDo(perms, e.perm));

  return (
    <div className={pageSurface}>
      <PageHeader
        title="Analytics"
        description={`Usage and revenue as of ${formatDateTime(u.generatedAt)} (${TIME_ZONE_LABEL}).`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="MRR (list price)" value={`BDT ${formatCount(u.mrr.listPriceBdt)}`} hint="Active subscriptions at list monthly price, comps included" />
        <Tile
          label={`Paid invoices (${u.revenue.windowDays} days)`}
          value={`BDT ${formatCount(u.revenue.totalBdt)}`}
          hint={`${formatCount(u.revenue.paidInvoices)} invoice${u.revenue.paidInvoices === 1 ? "" : "s"}`}
        />
        <Tile label="Active farms, 7 days" value={formatCount(u.activeFarms.last7Days)} hint="A member signed in or used the app" />
        <Tile label="Active farms, 30 days" value={formatCount(u.activeFarms.last30Days)} hint="A member signed in or used the app" />
      </div>

      <DetailSection title="Farms by plan and status">
        {u.subscriptions.byPlan.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
        ) : (
          <TableShell caption="Farms by plan and subscription status">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className={th}>Plan</th>
                <th className={th}>Status</th>
                <th className={th}>Farms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {u.subscriptions.byPlan.flatMap(({ plan, counts }) =>
                Object.entries(counts).map(([status, n]) => (
                  <tr key={`${plan}-${status}`}>
                    <td className={`${td} font-medium`}>{plan}</td>
                    <td className={td}>
                      <StatusBadge status={status} />
                    </td>
                    <td className={`${td} tabular-nums`}>{formatCount(n)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </TableShell>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Each farm is counted once, by its latest subscription.</p>
      </DetailSection>

      <DetailSection title="Expiring in the next 14 days">
        {u.expiring.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is about to expire.</p>
        ) : (
          <TableShell caption="Subscriptions expiring soon">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className={th}>Farm</th>
                <th className={th}>Plan</th>
                <th className={th}>Status</th>
                <th className={th}>Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {u.expiring.map((e) => (
                <tr key={e.farmId}>
                  <td className={td}>
                    <Link href={`/farms/${e.farmId}`} className="font-medium underline-offset-2 hover:underline">
                      {e.farm}
                    </Link>
                  </td>
                  <td className={td}>{e.plan}</td>
                  <td className={td}>
                    <StatusBadge status={e.status} />
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(e.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </DetailSection>

      {exports.length > 0 ? (
        <DetailSection title="Exports">
          <p className="mb-3 text-sm text-muted-foreground">
            CSV, newest first, at most 10,000 rows. Every export is recorded in the audit log. Treat the files as confidential.
          </p>
          <div className="flex flex-wrap gap-2">
            {exports.map((e) => (
              <a
                key={e.kind}
                href={`/api/export/${e.kind}`}
                download
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Download {humanizeEnum(e.label)}
              </a>
            ))}
          </div>
        </DetailSection>
      ) : null}
    </div>
  );
}

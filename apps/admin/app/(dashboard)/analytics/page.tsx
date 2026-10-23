import Link from "next/link";
import { PageHeader } from "@rakhal/ui/shared/page-header";
import { DetailSection, TableShell, pageSurface, td, th } from "@/components/directory/detail-list";
import { StatusBadge } from "@/components/directory/status-badge";
import { BarList, RateTile, Tile, TrendChart } from "@/components/insights/charts";
import { getEngagement, getUsage, type Engagement } from "@/lib/api/directory";
import { PermissionGate } from "@/lib/auth/permission-gate";
import { getSession } from "@/lib/auth/session";
import { formatCount, formatDateTime, humanizeEnum, TIME_ZONE_LABEL } from "@/lib/format";
import { canDo } from "@/lib/permissions";

const VIEWS = [
  { key: "engagement", label: "Engagement" },
  { key: "adoption", label: "Feature adoption" },
  { key: "geography", label: "Geography" },
  { key: "revenue", label: "Revenue" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

type SearchParams = Promise<{ view?: string }>;

export default function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <PermissionGate perm="analytics.read">
      <AnalyticsBody searchParams={searchParams} />
    </PermissionGate>
  );
}

/** Link tabs: each view is a real URL (shareable, back-button friendly, no client JS). */
function ViewTabs({ active }: { active: ViewKey }) {
  return (
    <nav aria-label="Analytics views" className="-mx-1 overflow-x-auto px-1">
      <ul className="inline-flex min-w-full gap-1 rounded-xl bg-muted p-1 sm:min-w-0">
        {VIEWS.map((v) => (
          <li key={v.key}>
            <Link
              href={v.key === "engagement" ? "/analytics" : `/analytics?view=${v.key}`}
              aria-current={v.key === active ? "page" : undefined}
              className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                v.key === active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function AnalyticsBody({ searchParams }: { searchParams: SearchParams }) {
  const { view } = await searchParams;
  const active: ViewKey = VIEWS.some((v) => v.key === view) ? (view as ViewKey) : "engagement";

  return (
    <div className={pageSurface}>
      <PageHeader title="Analytics" description="How people use Rakhal, which features earn their place, where farms are, and what they pay." />
      <ViewTabs active={active} />
      {active === "revenue" ? <RevenueView /> : <InsightView view={active} />}
    </div>
  );
}

async function InsightView({ view }: { view: Exclude<ViewKey, "revenue"> }) {
  const e = await getEngagement();
  return (
    <>
      <p className="text-xs text-muted-foreground">
        As of {formatDateTime(e.generatedAt)} ({TIME_ZONE_LABEL}). &quot;Active&quot; means a session was used; records come from the farm activity log.
      </p>
      {view === "engagement" ? <EngagementView e={e} /> : view === "adoption" ? <AdoptionView e={e} /> : <GeographyView e={e} />}
    </>
  );
}

function EngagementView({ e }: { e: Engagement }) {
  const hours = e.activation.medianHoursToFirstRecord;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Daily active users" value={formatCount(e.users.active.daily)} hint="Used the app in the last 24 hours" />
        <Tile label="Weekly active users" value={formatCount(e.users.active.weekly)} hint="Last 7 days" />
        <Tile label="Monthly active users" value={formatCount(e.users.active.monthly)} hint={`of ${formatCount(e.users.total)} accounts`} />
        <Tile
          label="Stickiness (DAU / MAU)"
          value={e.users.stickiness === null ? "-" : `${e.users.stickiness}%`}
          hint="How many monthly users come back daily"
        />
      </div>

      <DetailSection title="Daily active users, last 30 days">
        <TrendChart title="Daily active users" series={e.dailyActiveUsers} />
        <p className="mt-2 text-xs text-muted-foreground">
          Each day counts a user once, on the day their latest session use falls, so recent days are the most reliable.
        </p>
      </DetailSection>

      <DetailSection title="Activation and retention">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <RateTile
            label={`Activation rate (${e.activation.windowDays} days)`}
            rate={e.activation.rate}
            detail={`${formatCount(e.activation.activated)} of ${formatCount(e.activation.signedUp)} new users`}
            hint="Joined a farm that has recorded animals or activity"
          />
          <RateTile
            label="7-day retention"
            rate={e.retention.d7.rate}
            detail={`${formatCount(e.retention.d7.kept)} of ${formatCount(e.retention.d7.base)} came back`}
            hint="Used the app 7+ days after signing up"
          />
          <RateTile
            label="30-day retention"
            rate={e.retention.d30.rate}
            detail={`${formatCount(e.retention.d30.kept)} of ${formatCount(e.retention.d30.base)} came back`}
            hint="Used the app 30+ days after signing up"
          />
        </div>
      </DetailSection>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Returning users" value={formatCount(e.users.returning)} hint="Active this week, signed up earlier" />
        <Tile label="Dormant users" value={formatCount(e.users.dormant)} hint="No activity for 30+ days" />
        <Tile
          label="Never activated"
          value={formatCount(e.activation.neverActivated)}
          hint={`Signed up in ${e.activation.windowDays} days, no records yet`}
        />
        <Tile
          label="Signup to first record"
          value={hours === null ? "-" : hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`}
          hint="Median time from farm creation"
        />
      </div>
    </>
  );
}

const MODULE_LABELS: Record<string, string> = {
  COW_MANAGEMENT: "Cattle",
  MILK_PRODUCTION: "Milk production",
  BREEDING: "Reproduction",
  HEALTH_SAFETY: "Healthcare",
  FINANCE: "Finance",
  INVENTORY: "Inventory",
  GENERAL: "General and tasks",
};

function AdoptionView({ e }: { e: Engagement }) {
  // Show every module, including those no farm touched, so "least used" is visible instead of silently absent.
  const byModule = new Map(e.modules.map((m) => [m.module, m]));
  const rows = Object.keys(MODULE_LABELS)
    .map((module) => byModule.get(module) ?? { module, farms: 0, records: 0, shareOfActiveFarms: null })
    .sort((a, b) => b.farms - a.farms || b.records - a.records);
  const most = rows[0];
  const least = rows[rows.length - 1];

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Farms with recorded activity"
          value={formatCount(e.farms.withRecordsLast30Days)}
          hint={e.farms.shareWithRecordsLast30Days === null ? "Last 30 days" : `${e.farms.shareWithRecordsLast30Days}% of ${formatCount(e.farms.total)} farms, last 30 days`}
        />
        <Tile label="Cattle tracked" value={formatCount(e.records.cattleTracked)} hint="Animals on all farms" />
        <Tile label="Records, last 30 days" value={formatCount(e.records.last30Days)} hint="Milk, health, breeding, finance, inventory" />
        <Tile label="Farms ever recorded" value={formatCount(e.farms.everRecorded)} hint="At least one activity-log entry, ever" />
      </div>

      <DetailSection title="Module adoption, last 30 days">
        {e.records.last30Days === 0 ? (
          <p className="text-sm text-muted-foreground">No records in the last 30 days.</p>
        ) : (
          <>
            <BarList
              caption="Farms using each module in the last 30 days"
              items={rows.map((m) => ({
                key: m.module,
                label: MODULE_LABELS[m.module] ?? humanizeEnum(m.module),
                value: m.farms,
                hint: `${m.shareOfActiveFarms === null ? "0" : m.shareOfActiveFarms}% of active farms · ${formatCount(m.records)} records`,
              }))}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Most used: <span className="font-medium text-foreground">{MODULE_LABELS[most.module]}</span>. Least used:{" "}
              <span className="font-medium text-foreground">{MODULE_LABELS[least.module]}</span>.
            </p>
          </>
        )}
        <p className="mt-2 text-xs text-muted-foreground">A farm counts for a module when it wrote at least one activity-log entry there.</p>
      </DetailSection>
    </>
  );
}

function GeographyView({ e }: { e: Engagement }) {
  const g = e.geography;
  return (
    <>
      {g.divisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No farm has entered a location yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DetailSection title="Farms by division">
            <BarList
              caption="Farms by division"
              items={g.divisions.map((d) => ({ key: d.name, label: d.name, value: d.farms, hint: `${formatCount(d.cattle)} cattle` }))}
            />
          </DetailSection>
          <DetailSection title="Top districts">
            <BarList
              caption="Farms by district"
              items={g.districts.map((d) => ({
                key: `${d.division}-${d.district}`,
                label: d.division ? `${d.district}, ${d.division}` : d.district,
                value: d.farms,
              }))}
            />
          </DetailSection>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Only locations farm owners entered are counted. {formatCount(g.unspecifiedFarms)} farm{g.unspecifiedFarms === 1 ? "" : "s"} gave no location.
      </p>
    </>
  );
}

async function RevenueView() {
  const [u, session] = await Promise.all([getUsage(), getSession()]);
  const perms = session?.permissions ?? [];
  const exports = [
    { kind: "farms", label: "Farms", perm: "export.farms" },
    { kind: "subscriptions", label: "Subscriptions", perm: "export.farms" },
    { kind: "users", label: "Users (personal data)", perm: "export.users" },
  ].filter((e) => canDo(perms, e.perm));

  return (
    <>
      <p className="text-xs text-muted-foreground">
        As of {formatDateTime(u.generatedAt)} ({TIME_ZONE_LABEL}).
      </p>
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
              {u.expiring.map((x) => (
                <tr key={x.farmId}>
                  <td className={td}>
                    <Link href={`/farms/${x.farmId}`} className="font-medium underline-offset-2 hover:underline">
                      {x.farm}
                    </Link>
                  </td>
                  <td className={td}>{x.plan}</td>
                  <td className={td}>
                    <StatusBadge status={x.status} />
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(x.expiresAt)}</td>
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
            {exports.map((x) => (
              <a
                key={x.kind}
                href={`/api/export/${x.kind}`}
                download
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Download {humanizeEnum(x.label)}
              </a>
            ))}
          </div>
        </DetailSection>
      ) : null}
    </>
  );
}

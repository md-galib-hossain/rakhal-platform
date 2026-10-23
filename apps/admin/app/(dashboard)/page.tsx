import Link from "next/link";
import { Activity, Building2, CalendarDays, Sprout, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { PageHeader } from "@rakhal/ui/shared/page-header";
import { StatCard } from "@rakhal/ui/shared/stat-card";
import { DetailSection, pageSurface } from "@/components/directory/detail-list";
import { SignupBars } from "@/components/directory/signup-bars";
import { getOverview, listAudit } from "@/lib/api/directory";
import { getSession } from "@/lib/auth/session";
import { formatCount, formatDateTime, humanizeEnum, TIME_ZONE_LABEL } from "@/lib/format";
import { canDo } from "@/lib/permissions";

/** KPI tile (shared `StatCard`) with the supporting line under the value; links through when `href` is set. */
function Stat({
  label,
  value,
  hint,
  href,
  icon,
  iconClassName,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
  icon: React.ReactNode;
  iconClassName?: string;
}) {
  const card = (
    <StatCard
      label={label}
      value={
        <>
          {value}
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>
        </>
      }
      icon={icon}
      iconClassName={iconClassName}
      className={href ? "h-full transition-colors hover:bg-muted/40" : "h-full"}
    />
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  ) : (
    card
  );
}

export default async function OverviewPage() {
  const [o, session] = await Promise.all([getOverview(), getSession()]);
  const perms = session?.permissions ?? [];
  const subs = Object.entries(o.subscriptions.byStatus);
  // Recent admin activity is gated like the audit page itself; a role without `audit.read` simply does not see it.
  const recent = canDo(perms, "audit.read") ? (await listAudit({})).items.slice(0, 5) : null;
  const stickiness = o.users.activeLast30Days > 0 ? Math.round((o.users.activeLastDay / o.users.activeLast30Days) * 100) : null;

  return (
    <div className={pageSurface}>
      <PageHeader
        title="Overview"
        description={`Counts as of ${formatDateTime(o.generatedAt)} (${TIME_ZONE_LABEL}). Soft-deleted farms and users are excluded.`}
      />

      <section aria-labelledby="ov-people" className="space-y-3">
        <h2 id="ov-people" className="text-sm font-semibold text-muted-foreground">
          People
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Total users"
            value={formatCount(o.users.total)}
            hint={`${formatCount(o.users.blocked)} blocked`}
            href="/users"
            icon={<Users className="size-4" aria-hidden />}
            iconClassName="bg-accent-purple-tint text-accent-purple"
          />
          <Stat
            label="Active today"
            value={formatCount(o.users.activeLastDay)}
            hint={stickiness === null ? "No activity this month" : `${stickiness}% of monthly actives`}
            icon={<UserCheck className="size-4" aria-hidden />}
            iconClassName="bg-success-tint text-success"
          />
          <Stat
            label="Monthly active"
            value={formatCount(o.users.activeLast30Days)}
            hint="Used the app in the last 30 days"
            icon={<Activity className="size-4" aria-hidden />}
          />
          <Stat
            label="New users"
            value={formatCount(o.users.newLast7Days)}
            hint={`last 7 days · ${formatCount(o.users.newThisMonth)} this month`}
            icon={<UserPlus className="size-4" aria-hidden />}
            iconClassName="bg-accent-teal-tint text-accent-teal"
          />
        </div>
      </section>

      <section aria-labelledby="ov-farms" className="space-y-3">
        <h2 id="ov-farms" className="text-sm font-semibold text-muted-foreground">
          Farms
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Total farms"
            value={formatCount(o.farms.total)}
            hint={`${o.farms.byStatus.ACTIVE ?? 0} active, ${o.farms.byStatus.SUSPENDED ?? 0} suspended`}
            href="/farms"
            icon={<Building2 className="size-4" aria-hidden />}
          />
          <Stat
            label="New farms"
            value={formatCount(o.farms.newLast7Days)}
            hint={`last 7 days · ${formatCount(o.farms.newLast30Days)} in 30`}
            icon={<Sprout className="size-4" aria-hidden />}
            iconClassName="bg-success-tint text-success"
          />
          <Stat
            label="Farms this month"
            value={formatCount(o.farms.newThisMonth)}
            hint="Created since the 1st (UTC)"
            icon={<CalendarDays className="size-4" aria-hidden />}
            iconClassName="bg-accent-indigo-tint text-accent-indigo"
          />
          <Stat
            label="Blocked accounts"
            value={formatCount(o.users.blocked)}
            hint="Cannot sign in to Rakhal"
            href="/users"
            icon={<UserX className="size-4" aria-hidden />}
            iconClassName="bg-destructive-tint text-destructive"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailSection title="Signups">
          <div className="space-y-5">
            <SignupBars title="New farms per day" series={o.signups.farms} />
            <SignupBars title="New users per day" series={o.signups.users} />
          </div>
        </DetailSection>

        <div className="flex flex-col gap-4">
          <DetailSection title="Subscriptions by status">
            {subs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {subs.map(([status, count]) => (
                  <li key={status} className="flex items-center justify-between py-2 text-sm">
                    <span className="capitalize">{humanizeEnum(status)}</span>
                    <span className="font-medium tabular-nums">{formatCount(count)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Each farm is counted once, by its latest subscription.</p>
          </DetailSection>

          {recent ? (
            <DetailSection title="Recent admin activity">
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recent.map((a) => (
                    <li key={a.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-medium capitalize">{humanizeEnum(a.action)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{a.actorEmail ?? "system"}</span>
                      </span>
                      <time dateTime={a.createdAt} className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(a.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/audit" className="mt-3 inline-block text-xs font-medium underline-offset-2 hover:underline">
                View audit log
              </Link>
            </DetailSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}

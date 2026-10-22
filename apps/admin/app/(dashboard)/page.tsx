import Link from "next/link";
import { Building2, Sprout, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@rakhal/ui/shared/page-header";
import { StatCard } from "@rakhal/ui/shared/stat-card";
import { DetailSection, pageSurface } from "@/components/directory/detail-list";
import { SignupBars } from "@/components/directory/signup-bars";
import { getOverview } from "@/lib/api/directory";
import { formatCount, formatDateTime, humanizeEnum, TIME_ZONE_LABEL } from "@/lib/format";

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
  const o = await getOverview();
  const subs = Object.entries(o.subscriptions.byStatus);

  return (
    <div className={pageSurface}>
      <PageHeader
        title="Overview"
        description={`Counts as of ${formatDateTime(o.generatedAt)} (${TIME_ZONE_LABEL}). Soft-deleted farms and users are excluded.`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Farms"
          value={formatCount(o.farms.total)}
          hint={`${o.farms.byStatus.ACTIVE ?? 0} active, ${o.farms.byStatus.SUSPENDED ?? 0} suspended`}
          href="/farms"
          icon={<Building2 className="size-4" aria-hidden />}
        />
        <Stat
          label="New farms"
          value={formatCount(o.farms.newLast7Days)}
          hint={`last 7 days (${formatCount(o.farms.newLast30Days)} in 30)`}
          icon={<Sprout className="size-4" aria-hidden />}
          iconClassName="bg-success-tint text-success"
        />
        <Stat
          label="Users"
          value={formatCount(o.users.total)}
          hint={`${formatCount(o.users.blocked)} blocked`}
          href="/users"
          icon={<Users className="size-4" aria-hidden />}
          iconClassName="bg-accent-purple-tint text-accent-purple"
        />
        <Stat
          label="New users"
          value={formatCount(o.users.newLast7Days)}
          hint={`last 7 days (${formatCount(o.users.newLast30Days)} in 30)`}
          icon={<UserPlus className="size-4" aria-hidden />}
          iconClassName="bg-accent-teal-tint text-accent-teal"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailSection title="Signups">
          <div className="space-y-5">
            <SignupBars title="New farms per day" series={o.signups.farms} />
            <SignupBars title="New users per day" series={o.signups.users} />
          </div>
        </DetailSection>

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
      </div>
    </div>
  );
}

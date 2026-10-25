import { PageHeader } from "@rakhal/ui/shared/page-header";
import { PermissionGate } from "@/lib/auth/permission-gate";
import { pageSurface } from "@/components/directory/detail-list";
import { getCommunicationStats, type CommunicationStats } from "@/lib/api/directory";
import { BroadcastForm } from "./broadcast-form";

export const metadata = {
  title: "Outreach & Broadcast",
};

export default async function CommunicationsPage() {
  return (
    <PermissionGate perm="user.manage">
      <CommunicationsContent />
    </PermissionGate>
  );
}

async function CommunicationsContent() {
  let stats: CommunicationStats = {
    totalUsers: 0,
    telegramSubscribers: 0,
    pushSubscribers: 0,
  };

  try {
    stats = await getCommunicationStats();
  } catch {
    // Graceful fallback to zeros if backend is loading
  }

  return (
    <div className={pageSurface}>
      <PageHeader
        title="Direct Outreach & Broadcast"
        description="Deliver direct announcements and farm alerts to users via Telegram bot, Push, and in-app feeds."
        breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Communications" }]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Telegram Subscribers
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {stats.telegramSubscribers}
            </span>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              @rakhal_farm_bot
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Verified accounts actively receiving Telegram alerts
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Push Notification Devices
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {stats.pushSubscribers}
            </span>
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
              Web & App Push
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Registered devices for real-time alerts
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Farm Users
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {stats.totalUsers}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Platform Accounts
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            All registered farm owners and managers
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-foreground">Create Platform Broadcast</h2>
          <p className="text-xs text-muted-foreground">
            Send an instant notification campaign to all users or filtered Telegram subscribers.
          </p>
        </div>

        <BroadcastForm
          telegramSubscribers={stats.telegramSubscribers}
          totalUsers={stats.totalUsers}
        />
      </div>
    </div>
  );
}

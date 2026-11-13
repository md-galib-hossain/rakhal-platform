"use client"; // gates on the client session (permissions + plan), hosts the interactive sections

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ReportsHistory } from "../history/reports-history";
import { ScheduledReportCard } from "./scheduled-report-card";
import { useReportsAccessState } from "./use-reports-access-state";

function LandingSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

/** Body of `/reports`: no-access / plan notice, the two scheduled-report cards, then the history. */
export function ReportsLanding() {
  const t = useTranslations();
  const tl = useTranslations("reportsLanding");
  const access = useReportsAccessState();

  if (!access.ready) return <LandingSkeleton />;

  if (!access.canRead) {
    return (
      <EmptyState icon={Lock} title={t("reports.access.noPermission")} description={tl("noAccess.description")} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {access.planBlocked ? (
        <div
          id="reports-plan-notice"
          role="note"
          className="flex flex-col gap-1 rounded-xl border border-border bg-warning-tint px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            <span className="font-medium">{t("reports.access.featureRequired")}</span>{" "}
            <span className="text-muted-foreground">{tl("planBlocked.body")}</span>
          </p>
          <Link href="/settings?tab=billing" className="shrink-0 font-medium text-primary underline-offset-4 hover:underline">
            {tl("planBlocked.cta")}
          </Link>
        </div>
      ) : null}

      <section aria-label={tl("scheduled.title")} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">{tl("scheduled.title")}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ScheduledReportCard kind="WEEKLY" />
          <ScheduledReportCard kind="MONTHLY" />
        </div>
      </section>

      <ReportsHistory
        canRetry={access.canCreate && !access.planBlocked}
        canDelete={access.canDelete}
        canStartNew={access.canCreate && !access.planBlocked}
      />
    </div>
  );
}

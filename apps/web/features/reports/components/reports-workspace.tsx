"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { FileLock2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useHasFeature } from "@/features/subscription/hooks/use-subscription-gates";
import { ReportCatalogue } from "./report-catalogue";
import { SchedulesPanel } from "./schedules-panel";

/** RFE-041 — gates the whole page on the `reports.generate` subscription feature (Pro tier,
 * mirrors the backend's `@RequireFeature('reports.generate')` on `ReportsController`). The
 * schedules panel itself has no separate gate here — its create/delete actions 403 server-side
 * on `reports.scheduled` if a farm somehow has `reports.generate` without it (not a real plan
 * combination today, both ship together in PRO_FEATURES, but the UI doesn't assume that forever). */
export function ReportsWorkspace() {
  const t = useTranslations("reports");
  const hasFeature = useHasFeature();

  if (!hasFeature("reports.generate")) {
    return (
      <EmptyState
        icon={FileLock2}
        title={t("locked.title")}
        description={t("locked.description")}
        action={
          <Button asChild size="sm">
            <Link href="/billing">{t("locked.cta")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ReportCatalogue />
      <SchedulesPanel />
    </div>
  );
}

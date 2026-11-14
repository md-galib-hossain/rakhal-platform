import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { ActivityView } from "@/features/activity/components/activity-view";
import { ChainIntegrityBadge } from "@/features/activity/components/chain-integrity-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("activityLog")} — Rakhal`, robots: { index: false } };
}

/**
 * Activity Log (Figma node 734:50995, file `SCfMPdxP6vgW1uTxfqCtz7`) — real, cursor-backed
 * `GET /activity-log` timeline. See `features/activity/components/activity-view.tsx` for the
 * real-vs-mock gaps (no backend search endpoint).
 */
export default async function ActivityPage() {
  const t = await getTranslations("nav");

  return (
    <PageCard title={t("activityLog")} actions={<ChainIntegrityBadge />}>
      <ActivityView />
    </PageCard>
  );
}

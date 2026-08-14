import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { FeedingView } from "@/features/feeding/components/feeding-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("feeding")} — Rakhal`, robots: { index: false } };
}

/** "Feeding" (2026-08-13, user request) — daily-operations dashboard, separate from `/feed`
 * (Feed Formulator, where rations are built). See `FeedingView`'s doc comment. */
export default async function FeedingPage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("feeding")}>
      <FeedingView />
    </PageCard>
  );
}

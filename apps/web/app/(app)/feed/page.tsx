import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { FeedView } from "@/features/feed/components/feed-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("feedFormulator")} — Rakhal`, robots: { index: false } };
}

/** Feed Formulator — Figma "Feed Formulator" list frame (`1048:33190`) + "Create New Feed
 * Formulator" wizard Step 1 (`1065:35227`) + Step 2 (`1065:35817`), file
 * `SCfMPdxP6vgW1uTxfqCtz7`. See `features/feed/components/feed-view.tsx`'s doc comment for how the
 * two card sections map onto the single real `FeedConcentration` resource. Ingredients-table/feed-
 * group-management UI are a deferred follow-up pass (no Figma frame supplied yet). */
export default async function FeedPage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("feedFormulator")}>
      <Suspense fallback={null}>
        <FeedView />
      </Suspense>
    </PageCard>
  );
}

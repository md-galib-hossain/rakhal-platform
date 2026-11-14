import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { ReproductionWorkspace } from "@/features/reproduction/components/reproduction-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("reproduction")} — Rakhal`, robots: { index: false } };
}

/**
 * Reproduction module page:
 * Clean, focused dairy reproduction management. Export action removed per design requirement.
 */
export default async function ReproductionPage() {
  const t = await getTranslations("nav");

  return (
    <PageCard title={t("reproduction")}>
      <ReproductionWorkspace />
    </PageCard>
  );
}

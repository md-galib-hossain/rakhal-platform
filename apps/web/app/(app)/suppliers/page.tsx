import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Truck } from "lucide-react";
import { PageCard } from "@/components/shared/page-card";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("suppliers")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-381 — route scaffold only (MILESTONE 22, Phase D). Screen content (list, summary,
 * create/edit) is RAKHAL-390 (Phase E). This page exists so `/suppliers` is a real route the new
 * Business-group nav item can link to instead of 404ing.
 */
export default async function SuppliersPage() {
  const t = await getTranslations();
  return (
    <PageCard title={t("nav.suppliers")}>
      <EmptyState icon={Truck} title={t("common.comingSoonTitle")} description={t("common.comingSoonDescription")} />
    </PageCard>
  );
}

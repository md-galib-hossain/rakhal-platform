import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { SuppliersView } from "@/features/suppliers/components/suppliers-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("suppliers")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-390 — Suppliers module: aggregate-driven directory (`GET /purchasing/suppliers`,
 * RAKHAL-373) + full CRUD reusing the existing `/settings/suppliers` write API.
 */
export default async function SuppliersPage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("suppliers")}>
      <SuppliersView />
    </PageCard>
  );
}

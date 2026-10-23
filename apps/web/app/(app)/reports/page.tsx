import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("reports")} — Rakhal`, robots: { index: false } };
}

export default async function ReportsPage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("reports")}>
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("reports")}</p>
      </div>
    </PageCard>
  );
}

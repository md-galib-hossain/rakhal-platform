import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageCard } from "@/components/shared/page-card";
import { ReportWizard } from "@/features/reports/components/wizard/report-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reportsWizard");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

export default async function NewReportPage() {
  const t = await getTranslations("reportsWizard");
  return (
    <PageCard
      title={t("title")}
      actions={
        <Link href="/reports" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>
      }
    >
      <p className="-mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
      <ReportWizard />
    </PageCard>
  );
}

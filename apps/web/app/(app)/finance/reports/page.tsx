import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { ReportsView } from "@/features/finance/components/reports/reports-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance.reportsPage");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-387 — P&L, Cash Flow, Receivable/Payable Aging off RAKHAL-379, mounted here standalone.
 * Same "one component, two entry points" pattern `/finance/accounts`/`/finance/transactions`
 * already established — `ReportsView` is also the `reports` tab inside `FinanceView`.
 */
export default async function FinanceReportsPage() {
  const t = await getTranslations("finance.reportsPage");
  return (
    <PageCard title={t("title")}>
      <ReportsView />
    </PageCard>
  );
}

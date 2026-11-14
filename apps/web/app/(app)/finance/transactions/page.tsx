import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { TransactionsView } from "@/features/finance/components/transactions/transactions-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance.transactionsPage");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-385 — the unified `JournalTransaction`-header feed off `GET /finance/transactions`
 * (RAKHAL-370), mounted here standalone. Same "one component, two entry points" pattern
 * `/finance/accounts` (RAKHAL-356) already established — `TransactionsView` is also the
 * `transactions` tab inside `FinanceView`.
 */
export default async function FinanceTransactionsPage() {
  const t = await getTranslations("finance.transactionsPage");
  return (
    <PageCard title={t("title")}>
      <TransactionsView />
    </PageCard>
  );
}

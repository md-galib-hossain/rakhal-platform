import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { FinanceView } from "@/features/finance/components/finance-view";
import { FinanceHeaderActions } from "@/features/finance/components/finance-header-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("finance")} — Rakhal`, robots: { index: false } };
}

/** Finance — Figma "Finance" frame (Master Ledger `1039:24848` / Receivables `1039:33347` /
 * Payables `1039:33566` / Liabilities `1039:33785` / Asset Distribution `1039:33988`, Wallet
 * `1039:25473` / Add Funds `1039:32932` / Withdraw `1039:33295` / Record wizard `1039:25889`/
 * `1039:31829`/`1039:32190`/`1039:32555`, file `SCfMPdxP6vgW1uTxfqCtz7`): My Highlights KPI row +
 * 5-tab ledger/receivables/payables/liabilities/assets view, with the header's "Wallet"/"Record"
 * buttons opening the real Wallet hub (+ Add Funds/Withdraw) and the 4-type transaction wizard —
 * see `FinanceHeaderActions`' doc comment. No inline `<Suspense fallback={null}>` wrapper —
 * same reveal-hang bug the Feed Formulator Phase 10 pass already fixed on `/feed` (content
 * streamed correctly server-side but never revealed client-side); route-level `loading.tsx`
 * already covers the navigation-loading state, and every child view has its own skeleton for its
 * own data fetch, so the extra boundary here was pure downside. */
export default async function FinancePage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("finance")} actions={<FinanceHeaderActions />}>
      <FinanceView />
    </PageCard>
  );
}

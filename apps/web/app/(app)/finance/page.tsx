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
 * Payables `1039:33566` / Liabilities `1039:33785` / Asset Distribution `1039:33988`, file
 * `SCfMPdxP6vgW1uTxfqCtz7`): Rakhal Balance highlights + Quick Actions row + 5-tab
 * ledger/receivables/payables/liabilities/assets view. **RAKHAL-361 retired V1's Wallet hub/Add
 * Funds/Withdraw/4-type transaction wizard** (the Figma nodes those used to map to no longer apply)
 * — see `FinanceHeaderActions`' doc comment for why, and `finance-view.tsx`'s `QuickActions` for
 * where those actions live now. No inline `<Suspense fallback={null}>` wrapper —
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

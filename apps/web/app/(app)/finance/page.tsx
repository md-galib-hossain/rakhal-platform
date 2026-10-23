import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { FinanceView } from "@/features/finance/components/finance-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("finance")} — Rakhal`, robots: { index: false } };
}

/** Finance — Rakhal Balance highlights + Quick Actions row + the flattened Finance tab bar
 * (`Overview | Transactions | Receivables | Payables | Accounts | Reports`, RAKHAL-382, MILESTONE
 * 22 — replaces the old 5-tab Figma layout `finance-tabs.tsx`'s own history used to cite; Liabilities
 * and Asset Distribution moved to `/finance/liabilities`/`/finance/assets`, see those pages' doc
 * comments). **RAKHAL-361 retired V1's Wallet hub/Add Funds/Withdraw/4-type transaction wizard**
 * (the Figma nodes those used to map to no longer apply) — see `FinanceHeaderActions`' doc comment
 * for why, and `finance-view.tsx`'s `QuickActions` for where those actions live now. No inline
 * `<Suspense fallback={null}>` wrapper —
 * same reveal-hang bug the Feed Formulator Phase 10 pass already fixed on `/feed` (content
 * streamed correctly server-side but never revealed client-side); route-level `loading.tsx`
 * already covers the navigation-loading state, and every child view has its own skeleton for its
 * own data fetch, so the extra boundary here was pure downside. */
export default async function FinancePage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("finance")}>
      <FinanceView />
    </PageCard>
  );
}

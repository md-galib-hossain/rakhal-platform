import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { AccountsView } from "@/features/finance/components/accounts/accounts-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance.accountsPage");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-356 — Finance V2's Accounts + Rakhal Balance screen. `FINANCE_V2_DESIGN.md` §3 is the exact
 * spec: Rakhal Balance = Cash + Bank + MFS (computed, never stored), receivables excluded, a
 * transfer moves money between two accounts.
 *
 * **Route judgment call:** this is a standalone route (`/finance/accounts`), not a 6th tab folded
 * into V1's `FinanceTabs`/`FinanceView` (`features/finance/components/finance-tabs.tsx`/
 * `finance-view.tsx`). Reasoning: (1) the ticket brief states V1 is frozen — "no new features on
 * `features/finance/**` until [356-361] land" — and `finance-tabs.tsx`'s `FINANCE_TABS` constant plus
 * `finance-view.tsx`'s tab-switch `if` chain are exactly the kind of file that ticket freeze protects;
 * editing either to splice in a V2 tab would be a new feature landing on frozen V1 code. (2) V1's
 * "Wallet" concept (`FinanceHeaderActions`' Wallet/Add Funds/Withdraw dialogs) is what this screen
 * **replaces**, per the design doc's §3 resolution — the two can't coexist as sibling tabs on one
 * page without confusing which one is real. (3) RAKHAL-361 ("Domain entry points + retire V1 UI")
 * is explicitly the ticket that removes the V1 wallet/wizard dialogs and wires the real navigation
 * entry points — this page intentionally has no nav link yet and is reached by URL only, exactly the
 * "beside, not blended into" posture the milestone's own §2.1 cutover plan describes ("Freeze V1,
 * build V2 beside it. Cutover: V1 is deleted in RAKHAL-354, last"). RAKHAL-361 is the right ticket to
 * add the sidebar/nav entry pointing here.
 */
export default async function FinanceAccountsPage() {
  const t = await getTranslations("finance.accountsPage");
  return (
    <PageCard title={t("title")}>
      <AccountsView />
    </PageCard>
  );
}

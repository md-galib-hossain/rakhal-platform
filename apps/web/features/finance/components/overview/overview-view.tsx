import { FinanceHighlights } from "../finance-highlights";
import { QuickActions } from "./quick-actions";
import { OutstandingReceivablesPanel } from "./outstanding-receivables-panel";
import { RecentTransactionsPanel } from "./recent-transactions-panel";

/** RAKHAL-383 (MILESTONE 22) — Finance → Overview tab body (`BUSINESS_IA_PRD.md` §5.1): Row A +
 * Row B (`FinanceHighlights`) + Quick Actions + the two panels, side by side on desktop. */
export function OverviewView() {
  return (
    <div className="flex flex-col gap-4">
      <FinanceHighlights />
      <QuickActions />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OutstandingReceivablesPanel />
        <RecentTransactionsPanel />
      </div>
    </div>
  );
}

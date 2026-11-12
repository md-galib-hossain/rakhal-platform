import { FinanceHighlights } from "../finance-highlights";
import { OutstandingReceivablesPanel } from "./outstanding-receivables-panel";
import { RecentTransactionsPanel } from "./recent-transactions-panel";

/** RAKHAL-383 (MILESTONE 22) — Finance → Overview tab body (`BUSINESS_IA_PRD.md` §5.1): Row A +
 * Row B (`FinanceHighlights`) + the two panels, side by side on desktop. Quick Actions row removed
 * (no ticket, 2026-08-31) — it duplicated Transactions tab's New Transaction menu, and half its
 * buttons (Receive/Make Payment) only switched tabs without opening any dialog, a dead end when
 * the destination tab had no matching row to click. */
export function OverviewView() {
  return (
    <div className="flex flex-col gap-4">
      <FinanceHighlights />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OutstandingReceivablesPanel />
        <RecentTransactionsPanel />
      </div>
    </div>
  );
}

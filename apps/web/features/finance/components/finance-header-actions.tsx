"use client"; // export-button state

import { ReportExportButton } from "@/features/reports/components/report-export-button";
import { FINANCE_EXPORT_REPORT } from "@/features/reports/report-defs";

/**
 * RAKHAL-361 — Finance page header actions. V1's "Wallet" hub (+ Add Funds/Withdraw steps,
 * `wallet-dialog.tsx`/`add-funds-dialog.tsx`/`withdraw-dialog.tsx`) and 4-type transaction wizard
 * (`record-transaction-dialog.tsx`) are **deleted**, not just unmounted — grepped first, confirmed
 * nothing else imports them. This is the ticket's most important job: V1's wallet UI was the exact
 * dead end the user hit (added ৳50,000 via Add Funds, then couldn't find it on the new `/finance`
 * dashboard's "Rakhal Balance" — genuinely separate systems by design, but a confusing trap for a
 * real farmer). V2's equivalents — Record Sale/Expense/Other Income/Receive/Make Payment/Transfer —
 * now live in `finance-view.tsx`'s `QuickActions` row (RAKHAL-360 layout, RAKHAL-361 real wiring),
 * one level down from this header, so nothing is re-added here; only the pre-existing CSV/PDF
 * export action survives in the header itself.
 */
export function FinanceHeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <ReportExportButton report={FINANCE_EXPORT_REPORT} variant="secondary" size="md" />
    </div>
  );
}

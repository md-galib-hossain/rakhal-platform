"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { MoneyText } from "@/components/shared/money-text";
import { formatBusinessDay } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useRecentTransactions } from "./hooks";

const PANEL_LIMIT = 5;

/**
 * RAKHAL-383 — "Recent Transactions" panel, `GET /finance/transactions` (RAKHAL-370). The API's
 * `amount` is the unsigned document gross (always present, balanced by construction); `cashAmount`
 * is the net cash movement restricted to entries that actually touch a `FinancialAccount` — 0 for
 * a purely-accrual row (e.g. an unpaid credit sale, `Dr Receivable / Cr Revenue`, neither side a
 * `FinancialAccount`). This panel signs+colors by `cashAmount` when it's genuinely non-zero (a real
 * cash movement) and falls back to the plain unsigned `amount` — neutral color, no `+`/`-` — for a
 * cash-neutral row, rather than fabricating a sign the API doesn't provide. The real signed-by-type
 * convention for the full Transactions screen is RAKHAL-385's own scope, not this preview panel's.
 */
export function RecentTransactionsPanel() {
  const t = useTranslations("finance.overview.transactionsPanel");
  const locale = useLocale() as Locale;
  const query = useRecentTransactions(PANEL_LIMIT);
  const rows = query.data ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
      <p className="text-base font-semibold text-foreground">{t("title")}</p>

      {query.isLoading ? (
        <CardSkeleton className="h-40" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((row) => {
            const cash = Number(row.cashAmount);
            const displayAmount = cash !== 0 ? cash : Number(row.amount);
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {row.typeLabel}
                    {row.party ? ` · ${row.party.name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatBusinessDay(row.transactionDate, locale)}</p>
                </div>
                <MoneyText amount={displayAmount} colorize={cash !== 0} className="shrink-0 text-sm font-semibold" />
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/finance?tab=transactions" className="text-sm font-medium text-primary hover:underline">
        {t("viewAll")}
      </Link>
    </div>
  );
}

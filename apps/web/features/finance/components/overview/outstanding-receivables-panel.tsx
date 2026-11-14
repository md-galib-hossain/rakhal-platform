"use client"; // client-side filter/sort of an already-cached un-paginated list

import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { MoneyText } from "@/components/shared/money-text";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useSalesV2 } from "../../hooks/use-finance-v2";

const PANEL_LIMIT = 5;

/**
 * RAKHAL-383 — "Outstanding Receivables" panel. Reuses `useSalesV2()` (RAKHAL-360, already cached
 * for the Ledger's Sales segment) rather than `GET /finance/receivables` — that route returns a
 * bare `Receivable` row with no embedded buyer name or invoice number (confirmed reading
 * `receivable.service.ts#listReceivables`: no `include`, just the raw row + computed
 * `outstanding`/`status`), while `Sale` (RAKHAL-368's real `paymentStatus`/`dueAmount`/`dueDate`
 * projection, already fetched here) already carries everything this panel needs in one place —
 * `customer.name`, `saleNumber` (the real `INV-` prefix), `dueAmount`, `dueDate`. No `?sortBy=` or
 * `?paymentStatus=` filter is wired here (out of this ticket's lane — `api-v2.ts`/`use-finance-v2.ts`
 * belong to other Phase E tickets); client-side filter+sort over the same small un-paginated list
 * every other Finance V2 screen already treats as small-enough-for-this (`AccountPicker`,
 * `LiabilitiesView`'s own precedent).
 */
export function OutstandingReceivablesPanel() {
  const t = useTranslations("finance.overview.receivablesPanel");
  const locale = useLocale() as Locale;
  const query = useSalesV2();

  const rows = (query.data ?? [])
    .filter((s) => s.paymentStatus !== "PAID")
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, PANEL_LIMIT);

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
          {rows.map((sale) => {
            const due = dueLabel(sale.dueDate, t);
            return (
              <li key={sale.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate text-sm font-medium text-foreground">{sale.customer?.name ?? t("unknownBuyer")}</p>
                  <p className="text-xs text-muted-foreground">{sale.saleNumber}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <MoneyText amount={Number(sale.dueAmount)} className="text-sm font-semibold text-foreground" />
                  <p className={cn("text-xs", due.overdue ? "text-destructive" : "text-muted-foreground")}>{due.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/finance?tab=receivables" className="text-sm font-medium text-primary hover:underline">
        {t("viewAll")}
      </Link>
    </div>
  );

  function dueLabel(dueDate: string | null, translate: typeof t): { text: string; overdue: boolean } {
    if (!dueDate) return { text: translate("noDueDate"), overdue: false };
    const days = differenceInCalendarDays(new Date(dueDate), new Date());
    if (days < 0) return { text: translate("overdueDays", { count: -days }), overdue: true };
    if (days === 0) return { text: translate("dueToday"), overdue: false };
    return { text: translate("dueOn", { date: formatDate(dueDate, locale) }), overdue: false };
  }
}

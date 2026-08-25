"use client"; // live query

import { useTranslations } from "next-intl";
import { Banknote, Landmark, Smartphone, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { cn } from "@/lib/utils";
import { useFinancialSnapshot } from "@/features/dashboard/hooks/use-dashboard-widgets";
import { useRakhalBalance } from "../hooks/use-finance-v2";
import type { FinancialAccountType } from "../types-v2";

const ACCOUNT_TYPE_ICON: Record<FinancialAccountType, typeof Wallet> = {
  CASH: Banknote,
  BANK: Landmark,
  MFS: Smartphone,
};

function KpiTile({
  icon,
  iconBg,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-2 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg shadow-xs", iconBg)}>{icon}</span>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function ChangePill({ changePct }: { changePct: number | null }) {
  if (changePct == null) return null;
  const positive = changePct >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", positive ? "text-success" : "text-destructive")}>
      <Icon className="size-3" aria-hidden />
      {positive ? "+" : ""}
      {changePct}%
    </span>
  );
}

/**
 * RAKHAL-360 — "My Highlights" card rebuilt on Finance V2 endpoints. Replaces the V1 wallet-era
 * version (which read `GET /finance/highlights`'s `availableLiquidity`/`herdMarketValue`/
 * `survivalRunway*` — kept alive on V1's own routes, untouched, just no longer used here).
 *
 * Sourced from two reads, per the ticket brief: `GET /finance/balance` (RAKHAL-336, via
 * `useRakhalBalance`) for the Rakhal Balance headline + Cash/Bank/MFS breakdown, and the existing
 * `GET /dashboard/financial-snapshot` (RAKHAL-351 additively re-pointed it at V2 ledger activity,
 * `features/dashboard/hooks/use-dashboard-widgets.ts#useFinancialSnapshot` — reused as-is, not
 * re-implemented) for this month's income/expenses/net cash flow.
 *
 * **Split decision vs RAKHAL-356** ("Accounts + Rakhal Balance screen, opening balances,
 * transfers", `docs/IN_FLIGHT.md`): this card is a **read-only summary** — headline number +
 * breakdown table + KPIs, no create/edit/archive/transfer actions. 356 owns the full account
 * management screen (`features/finance/components/accounts/**`) that this card does not duplicate;
 * per-account rows here are display-only, not linked into an edit flow (356's screen is the
 * intended destination for that, wired once 356 lands and a stable route exists — not guessed at
 * here).
 *
 * **Receivable/Payable position — rendered as "not yet available", not a fake ৳0**: `GET
 * /finance/balance`'s own `receivablePayable.wired` is `false` (verified against
 * `BalanceService.getReceivablePayablePosition` directly — despite `Receivable`/`Payable` v2 both
 * being `DONE`, RAKHAL-336's balance endpoint was never re-pointed at them). `FINANCE_V2_DESIGN.md`
 * §9's own risk callout is "never show debits and credits" — showing a confident ৳0 here would be a
 * different but just as real honesty failure (implying the farm has no outstanding receivables/
 * payables when the truth is simply "not computed yet"), so this card shows an explicit
 * not-available state instead, same "flagged, not fabricated" precedent this codebase uses
 * elsewhere (e.g. `features/finance/types.ts`'s own doc comment on `herdMarketValue`).
 */
export function FinanceHighlights() {
  const t = useTranslations("finance.balance");
  const balanceQuery = useRakhalBalance();
  const snapshotQuery = useFinancialSnapshot();

  const isLoading = balanceQuery.isLoading || snapshotQuery.isLoading;
  const isError = balanceQuery.isError || snapshotQuery.isError;

  if (isLoading) return <CardSkeleton lines={5} className="rounded-2xl" />;
  if (isError) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <ErrorState
          description={t("error")}
          onRetry={() => {
            void balanceQuery.refetch();
            void snapshotQuery.refetch();
          }}
        />
      </div>
    );
  }
  const balance = balanceQuery.data;
  const snapshot = snapshotQuery.data;
  if (!balance || !snapshot) return null;

  const netCashFlow = snapshot.profit;
  const receivablePayable = balance.receivablePayable;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">{t("title")}</p>
        <p className="text-3xl font-bold text-foreground">
          <MoneyText amount={Number(balance.rakhalBalance)} />
        </p>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Cash / Bank / MFS breakdown */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(
          [
            { type: "CASH" as const, amount: balance.breakdown.cash },
            { type: "BANK" as const, amount: balance.breakdown.bank },
            { type: "MFS" as const, amount: balance.breakdown.mfs },
          ]
        ).map(({ type, amount }) => {
          const Icon = ACCOUNT_TYPE_ICON[type];
          return (
            <div key={type} className="flex items-center gap-2 rounded-xl border border-border p-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-indigo-tint shadow-xs">
                <Icon className="size-4 text-accent-indigo" aria-hidden />
              </span>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">{t(`accountType.${type}`)}</span>
                <MoneyText amount={Number(amount)} className="text-sm font-semibold text-foreground" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Receivable / Payable position */}
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{t("receivablePosition")}</span>
          <span className="text-sm font-semibold text-foreground">
            {receivablePayable.wired ? <MoneyText amount={Number(receivablePayable.totalReceivable)} /> : t("notYetAvailable")}
          </span>
        </div>
        <div className="flex flex-col sm:text-right">
          <span className="text-xs text-muted-foreground">{t("payablePosition")}</span>
          <span className="text-sm font-semibold text-foreground">
            {receivablePayable.wired ? <MoneyText amount={Number(receivablePayable.totalPayable)} /> : t("notYetAvailable")}
          </span>
        </div>
      </div>

      {/* Month KPIs */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <KpiTile
          icon={<Wallet className="size-4 text-success" aria-hidden />}
          iconBg="bg-success-tint"
          label={t("income")}
          value={<MoneyText amount={snapshot.income.current} />}
          subtitle={<ChangePill changePct={snapshot.income.changePct} />}
        />
        <KpiTile
          icon={<Wallet className="size-4 text-destructive" aria-hidden />}
          iconBg="bg-destructive-tint"
          label={t("expenses")}
          value={<MoneyText amount={snapshot.expenses.current} />}
          subtitle={<ChangePill changePct={snapshot.expenses.changePct} />}
        />
        <KpiTile
          icon={<Wallet className="size-4 text-accent-indigo" aria-hidden />}
          iconBg="bg-accent-indigo-tint"
          label={t("netCashFlow")}
          value={<MoneyText amount={netCashFlow.current} colorize />}
          subtitle={<ChangePill changePct={netCashFlow.changePct} />}
        />
      </div>
    </div>
  );
}

"use client"; // live balance query

import { useTranslations } from "next-intl";
import { Landmark, Smartphone, Wallet } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRakhalBalance } from "../../hooks/use-finance-v2";

/**
 * RAKHAL-356 — "Rakhal Balance" headline: big total + Cash/Bank/MFS breakdown cards, per
 * `FINANCE_V2_DESIGN.md` §3 ("Rakhal Balance = Cash + Bank + MFS, computed, never stored — receivables
 * excluded, that money has not arrived"). Every amount off the wire is a Decimal-as-string
 * (`types-v2.ts#RakhalBalanceResult`'s doc comment) — converted via `Number(...)` right before
 * handing to `MoneyText`, same discipline RAKHAL-358's `types-v2.ts` additions document for their own
 * money fields.
 *
 * Receivable/payable renders as a **visually separate position block** below the balance cards, per
 * the ticket brief — never summed into the total, and shown as "not yet available" rather than a
 * fake ৳0 while the backend's `receivablePayable.wired` is `false` (verified live against the current
 * `BalanceService` source — RAKHAL-340/348 landing did not re-point this specific endpoint; see
 * `types-v2.ts`'s doc comment for the full trail).
 */
export function RakhalBalanceCard() {
  const t = useTranslations("finance.accountsPage.balance");
  const query = useRakhalBalance();

  if (query.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <Card className="rounded-2xl p-4">
        <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
      </Card>
    );
  }

  const data = query.data;
  if (!data) return null;

  const breakdownTiles = [
    { key: "cash", label: t("cash"), icon: Wallet, value: data.breakdown.cash },
    { key: "bank", label: t("bank"), icon: Landmark, value: data.breakdown.bank },
    { key: "mfs", label: t("mfs"), icon: Smartphone, value: data.breakdown.mfs },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">{t("title")}</p>
          <p className="text-4xl font-bold text-foreground">
            <MoneyText amount={Number(data.rakhalBalance)} />
          </p>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {breakdownTiles.map(({ key, label, icon: Icon, value }) => (
            <div key={key} className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-info-tint text-info shadow-xs">
                  <Icon className="size-4" aria-hidden />
                </span>
                <p className="text-sm font-medium text-foreground">{label}</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                <MoneyText amount={Number(value)} />
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Position block — deliberately a visually distinct card, never merged into the balance total
          above (design brief: "Receivable/payable shown as a SEPARATE position block"). */}
      <Card className={cn("flex flex-col gap-3 rounded-2xl border-dashed p-4", !data.receivablePayable?.wired && "opacity-80")}>
        <p className="text-sm font-medium text-foreground">{t("positionTitle")}</p>
        {data.receivablePayable?.wired ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">{t("receivable")}</p>
              <p className="text-lg font-semibold text-success">
                <MoneyText amount={Number(data.receivablePayable.totalReceivable)} />
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">{t("payable")}</p>
              <p className="text-lg font-semibold text-destructive">
                <MoneyText amount={Number(data.receivablePayable.totalPayable)} />
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("notYetAvailable")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("positionCaption")}</p>
      </Card>
    </div>
  );
}

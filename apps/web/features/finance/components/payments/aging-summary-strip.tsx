"use client"; // live aging query

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { Card } from "@/components/ui/card";

/** Mirrors `AgingReport`/`AgingBucketResult` (`business-reporting/application/aging.service.ts`,
 * RAKHAL-369) directly. `amount` is Decimal-as-string. */
interface AgingBucket {
  key: "CURRENT" | "OVERDUE_8_30" | "OVERDUE_31_PLUS";
  label: string;
  minDays: number;
  maxDays: number | null;
  amount: string;
  invoiceCount: number;
}
interface AgingReport {
  asOf: string;
  buckets: AgingBucket[];
  totalOutstanding: string;
  totalCount: number;
}

/**
 * RAKHAL-386 — the Aging Summary strip both Receivables and Payables carry (`BUSINESS_IA_PRD.md`
 * §5.9). One shared component, `kind` picks the real route: `GET /finance/receivables/aging`
 * (`finance.read`) or `GET /purchasing/payables/aging` (`purchasing.read`) — both RAKHAL-369, both
 * already a full SQL `GROUP BY` aggregate server-side (never rows reduced in Node, per that
 * service's own doc comment on RD-059). Bucket labels (`"Current (0–7 days)"` etc.) come straight
 * from the API — never re-derived or hardcoded client-side, so a future bucket-edge change needs no
 * frontend edit.
 */
export function AgingSummaryStrip({ kind }: { kind: "RECEIVABLE" | "PAYABLE" }) {
  const t = useTranslations("finance.settlementsV2.aging");
  const query = useQuery({
    queryKey: kind === "RECEIVABLE" ? qk.finance.receivablesAgingV2() : qk.finance.payablesAgingV2(),
    queryFn: () =>
      apiFetch<AgingReport>(kind === "RECEIVABLE" ? "/finance/receivables/aging" : "/purchasing/payables/aging"),
    staleTime: 60_000,
  });

  if (query.isLoading) return <CardSkeleton lines={2} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <Card className="rounded-2xl p-4">
        <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
      </Card>
    );
  }
  const data = query.data;
  if (!data) return null;

  return (
    <Card className="flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <p className="text-sm font-semibold text-foreground">
          <MoneyText amount={Number(data.totalOutstanding)} /> · {t("invoiceCount", { count: data.totalCount })}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data.buckets.map((bucket) => (
          <div key={bucket.key} className="flex flex-col gap-1 rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">{bucket.label}</p>
            <p className="text-lg font-semibold text-foreground">
              <MoneyText amount={Number(bucket.amount)} />
            </p>
            <p className="text-xs text-muted-foreground">{t("invoiceCount", { count: bucket.invoiceCount })}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

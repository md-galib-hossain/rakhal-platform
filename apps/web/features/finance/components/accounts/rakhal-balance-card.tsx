"use client"; // live balance query

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { Card } from "@rakhal/ui/ui/card";
import { useRakhalBalance } from "../../hooks/use-finance-v2";

/**
 * RAKHAL-356 — "Rakhal Balance" headline: big total + (no breakdown tiles: one account), per
 * `FINANCE_V2_DESIGN.md` §3 ("Rakhal Balance = Cash + Bank + MFS, computed, never stored — receivables
 * excluded, that money has not arrived"). Every amount off the wire is a Decimal-as-string
 * (`types-v2.ts#RakhalBalanceResult`'s doc comment) — converted via `Number(...)` right before
 * handing to `MoneyText`, same discipline RAKHAL-358's `types-v2.ts` additions document for their own
 * money fields.
 *
 * RAKHAL-394 (closes the §5.15/§1.2 "delete the literal 'Not yet available' string" mandate): the
 * "position block" this card used to render below the balance cards read `data.receivablePayable`,
 * a field `GET /finance/balance` stopped returning entirely once RAKHAL-371 retired the fake
 * always-zeroed placeholder — so the block was permanently stuck on its "not yet available" fallback,
 * never a real number. RAKHAL-386 (Receivables/Payables screens) has since shipped the real thing;
 * this card now links straight to those tabs instead of rendering a block that could never resolve.
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

      </Card>

      {/* Position block — never summed into the balance total above (design brief: "Receivable/
          payable shown as a SEPARATE position block"). Links to the real Receivables/Payables tabs
          instead of rendering its own numbers — see the file's own doc comment for why. */}
      <Card className="flex flex-col gap-3 rounded-2xl border-dashed p-4">
        <p className="text-sm font-medium text-foreground">{t("positionTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("positionCaption")}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <Link href="/finance?tab=receivables" className="text-sm font-medium text-primary hover:underline">
            {t("viewReceivables")}
          </Link>
          <Link href="/finance?tab=payables" className="text-sm font-medium text-primary hover:underline">
            {t("viewPayables")}
          </Link>
        </div>
      </Card>
    </div>
  );
}

"use client"; // live query

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@rakhal/ui/ui/card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { useBuyerOverview } from "../../hooks/use-buyers";

/** RAKHAL-389 — buyer detail Overview tab (`BUSINESS_IA_PRD.md` §5.11): Recent Invoices panel
 * (`Invoice | Date | Amount | Due Date | Status`) + Buyer Info panel (Phone/Address/Payment Terms/
 * Default Milk Rate/Buyer Group), footer "View all invoices →". Both off `GET /buyers/:id/overview`
 * (RAKHAL-372) — `address` is always `null` (no `MilkBuyer.address` column exists), rendered
 * honestly as "—" rather than fabricated. */
export function BuyerOverviewTab({ buyerId }: { buyerId: string }) {
  const t = useTranslations("buyers.detail.overview");
  const query = useBuyerOverview(buyerId);

  if (query.isLoading) return <CardSkeleton lines={6} className="rounded-2xl" />;
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-3">
          <CardTitle className="text-base">{t("recentInvoices")}</CardTitle>
          <Link href={`/buyers/${buyerId}?tab=sales`} className="text-xs font-medium text-primary hover:underline">
            {t("viewAllInvoices")}
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border p-0">
          {data.recentInvoices.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t("noInvoices")}</p>
          ) : (
            data.recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{inv.saleNumber}</span>
                  <DateText date={inv.saleDate} className="text-xs text-muted-foreground" />
                </div>
                <MoneyText amount={Number(inv.totalAmount)} className="text-sm font-medium" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">{t("buyerInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4 pt-0">
          <InfoRow label={t("phone")} value={data.info.phone ?? "—"} />
          <InfoRow label={t("address")} value={data.info.address ?? "—"} />
          <InfoRow label={t("paymentTerms")} value={t("paymentTermsDays", { days: data.info.paymentTermsDays })} />
          <InfoRow label={t("defaultMilkRate")} value={<MoneyText amount={data.info.basePricePerLitre} />} />
          <InfoRow label={t("buyerGroup")} value={t(`typeOptions.${data.info.buyerType}`)} />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

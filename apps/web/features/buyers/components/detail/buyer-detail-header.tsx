"use client"; // edit dialog open state

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { DateText } from "@/components/shared/date-text";
import { Can } from "@/lib/auth/permissions";
import { useBuyerOverview } from "../../hooks/use-buyers";
import { BuyerFormDialog } from "../buyer-form-dialog";
import type { Buyer } from "../../types";

/** RAKHAL-389 — buyer detail page header (`BUSINESS_IA_PRD.md` §5.11): `← Back to Buyers` · buyer
 * name · `Edit Buyer`, plus 3 header stats (Outstanding Amount, Total Purchased this year, Last
 * Payment), off `GET /buyers/:id/overview` (RAKHAL-372). Edit gated `finance.update` — the real
 * permission `PATCH /buyers/:id` requires (`buyer.controller.ts`), not `settings.update`. */
export function BuyerDetailHeader({ buyer }: { buyer: Buyer }) {
  const t = useTranslations("buyers.detail");
  const query = useBuyerOverview(buyer.id);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/buyers" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            {t("backToBuyers")}
          </Link>
          <p className="text-xl font-bold text-foreground">{buyer.name}</p>
        </div>
        <Can I="finance.update">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" aria-hidden />
            {t("editBuyer")}
          </Button>
        </Can>
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} lines={2} className="rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card className="rounded-2xl p-4">
          <ErrorState description={t("overviewError")} onRetry={() => void query.refetch()} />
        </Card>
      ) : query.data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="rounded-xl p-3">
            <p className="text-sm text-muted-foreground">{t("outstandingAmount")}</p>
            <MoneyText amount={Number(query.data.outstandingAmount)} className="text-2xl font-bold text-destructive" />
          </Card>
          <Card className="rounded-xl p-3">
            <p className="text-sm text-muted-foreground">{t("totalPurchased")}</p>
            <MoneyText amount={Number(query.data.totalPurchasedThisYear)} className="text-2xl font-bold text-foreground" />
            <p className="text-xs text-muted-foreground">{t("thisYear")}</p>
          </Card>
          <Card className="rounded-xl p-3">
            <p className="text-sm text-muted-foreground">{t("lastPayment")}</p>
            {query.data.lastPayment ? (
              <>
                <MoneyText amount={Number(query.data.lastPayment.amount)} className="text-2xl font-bold text-foreground" />
                <DateText date={query.data.lastPayment.date} className="text-xs text-muted-foreground" />
              </>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            )}
          </Card>
        </div>
      ) : null}

      <BuyerFormDialog buyer={buyer} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

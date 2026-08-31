"use client"; // live query

import { useTranslations } from "next-intl";
import { Building2, Handshake, Store, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { useBuyerGroups } from "../hooks/use-buyers";
import type { BuyerType } from "../types";

const GROUP_ICON: Record<BuyerType, typeof Building2> = {
  DAIRY_COMPANY: Building2,
  COOPERATIVE: Handshake,
  LOCAL_TRADER: Store,
  DIRECT_CONSUMER: User,
};

/** RAKHAL-389 — "Buyer Groups" tab (`BUSINESS_IA_PRD.md` §5.10): the existing `BuyerType` enum
 * rendered as 4 cards with per-group buyer count and total sales, off `GET /buyers/groups`
 * (RAKHAL-372) — no new model, zero-filled for a value with no buyers. */
export function BuyerGroupsView() {
  const t = useTranslations("buyers.groups");
  const query = useBuyerGroups();

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} lines={2} className="rounded-xl" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <Card className="rounded-2xl p-4">
        <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
      </Card>
    );
  }

  const groups = query.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {groups.map((group) => {
        const Icon = GROUP_ICON[group.buyerType];
        return (
          <Card key={group.buyerType} className="flex flex-col gap-3 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-info-tint text-info shadow-sm">
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="text-sm font-medium text-foreground">{t(`typeOptions.${group.buyerType}`)}</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-2xl font-bold text-foreground">{t("buyerCount", { count: group.buyerCount })}</p>
              <MoneyText amount={Number(group.totalSales)} className="text-sm text-muted-foreground" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { MobileRecordCard } from "@/components/shared/mobile-record-card";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import { buildBuyerColumns } from "./buyer-columns";
import type { BuyerListRow } from "../types";

export function BuyerTable({
  items,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onDeactivate,
  onStatement,
  onSellMilk,
  onAdd,
}: {
  items: BuyerListRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (buyer: BuyerListRow) => void;
  onDeactivate: (buyer: BuyerListRow) => void;
  onStatement: (buyer: BuyerListRow) => void;
  onSellMilk: (buyer: BuyerListRow) => void;
  /** Empty-state CTA — shown behind `finance.create`. */
  onAdd?: () => void;
}) {
  const t = useTranslations("buyers.list");
  const columns = useMemo(
    () => buildBuyerColumns(t, { onEdit, onDeactivate, onStatement, onSellMilk }),
    [t, onEdit, onDeactivate, onStatement, onSellMilk],
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border",
        "[&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted",
        "[&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground",
        "[&_tbody_td]:py-2",
      )}
    >
      <DataTable
        columns={columns}
        data={items}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyState={{
          title: t("empty.title"),
          description: t("empty.description"),
          action: onAdd ? (
            <Can I="finance.create">
              <Button size="sm" className="gap-1.5" onClick={onAdd}>
                <Plus className="size-4" aria-hidden />
                {t("addBuyer")}
              </Button>
            </Can>
          ) : undefined,
        }}
        renderMobileCard={(buyer) => (
          <MobileRecordCard
            title={
              <Link href={`/buyers/${buyer.id}`} className="text-primary hover:underline">
                {buyer.name}
              </Link>
            }
            subtitle={buyer.phone ?? buyer.contactPerson ?? undefined}
            trailing={<MoneyText amount={Number(buyer.outstanding)} colorize={Number(buyer.outstanding) > 0} />}
            badges={buyer.status === "INACTIVE" ? <Badge variant="outline">{t("statusInactive")}</Badge> : undefined}
            fields={[
              { label: t("columns.outstanding"), value: <MoneyText amount={Number(buyer.outstanding)} /> },
              { label: t("columns.totalPurchased"), value: <MoneyText amount={Number(buyer.totalPurchased)} /> },
            ]}
            actions={
              <>
                {buyer.status === "ACTIVE" ? (
                  <Can I="finance.create">
                    <Button size="sm" variant="secondary" onClick={() => onSellMilk(buyer)}>
                      {t("actionsColumn.sellMilk")}
                    </Button>
                  </Can>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => onStatement(buyer)}>
                  {t("actionsColumn.statement")}
                </Button>
                <Can I="finance.update">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(buyer)}>
                    {t("actionsColumn.edit")}
                  </Button>
                </Can>
              </>
            }
          />
        )}
      />
    </div>
  );
}

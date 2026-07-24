"use client"; // columns need client callbacks (translation function)

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/data-table";
import { buildSettlementsColumns } from "./settlements-columns";
import type { ReceivableKind, Settlement } from "../types";

export function SettlementsTable({
  kind,
  items,
  isLoading,
  isError,
  onRetry,
  onRecordPayment,
}: {
  kind: ReceivableKind;
  items: Settlement[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRecordPayment: (settlement: Settlement) => void;
}) {
  const namespace = kind === "RECEIVABLE" ? "finance.receivables" : "finance.payables";
  const t = useTranslations(namespace);
  const columns = useMemo(() => buildSettlementsColumns(t, onRecordPayment), [t, onRecordPayment]);

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
        emptyState={{ title: t("empty.title"), description: t("empty.description") }}
      />
    </div>
  );
}

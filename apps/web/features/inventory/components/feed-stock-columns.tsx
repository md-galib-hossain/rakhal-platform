"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@rakhal/ui/ui/avatar";
import { Package, Trash2 } from "lucide-react";
import { Chip } from "@rakhal/ui/ui/chip";
import { Can } from "@/lib/auth/permissions";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { avatarTint } from "../avatar-tint";
import type { FeedConcentrationKind, FeedStock } from "@/features/feed/types";
import { costPerKg, remainingStatus, REMAINING_STOCK_COLOR } from "./feed-stock-metrics";
import { TruncatedText } from "@/components/shared/truncated-text";

export interface FeedStockSource {
  name: string;
  kind: FeedConcentrationKind;
}

/** Column set for the Feed tab's "Prepared" table view — same anatomy as `buildFeedItemColumns`
 * (Purchased) so the two segments read as one consistent module, not two different UIs bolted
 * together. A `FeedStock` lot has no edit/view-details flow of its own (it's only produced via
 * Finalize/consumed via "Feed Today" on the Feed Formulator page) but it can be **deleted** from
 * here (user request 2026-07-19 — "form inventory it can be also deleted") — a single delete icon
 * rather than a dropdown, since delete is the only action this row ever has. */
export function buildFeedStockColumns(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  tFeed: (key: string) => string,
  startIndex: number,
  sourceById: Map<string, FeedStockSource>,
  onDelete: (lot: FeedStock) => void,
): ColumnDef<FeedStock, unknown>[] {
  return [
    {
      id: "no",
      header: t("columns.no"),
      size: 48,
      cell: ({ row }) => <span className="text-muted-foreground">{String(startIndex + row.index + 1).padStart(2, "0")}</span>,
    },
    {
      id: "name",
      header: t("columns.name"),
      cell: ({ row }) => {
        const source = sourceById.get(row.original.source_concentration_id);
        return (
          <div className="flex items-center gap-2">
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className={avatarTint(row.original.id)}>
                <Package className="size-4" aria-hidden />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <TruncatedText className="max-w-[16rem] text-sm font-medium text-foreground">{source?.name ?? t("unknownSource")}</TruncatedText>
              {source ? (
                <Chip variant="muted" className="w-fit px-2 py-0 text-xs">
                  {source.kind === "FEED_MIXTURE" ? tFeed("feedMixture") : tFeed("concentrationTemplate")}
                </Chip>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "producedAt",
      header: t("columns.producedDate"),
      cell: ({ row }) => <DateText date={row.original.produced_at} />,
    },
    {
      id: "producedQty",
      header: t("columns.producedQty"),
      cell: ({ row }) => <span className="text-sm text-foreground">{row.original.produced_qty_kg} kg</span>,
    },
    {
      id: "remainingQty",
      header: t("columns.remainingQty"),
      cell: ({ row }) => {
        const status = remainingStatus(row.original.current_stock_kg, row.original.produced_qty_kg);
        return (
          <span className={`text-sm font-bold ${REMAINING_STOCK_COLOR[status]}`}>{row.original.current_stock_kg} kg</span>
        );
      },
    },
    {
      id: "consumedQty",
      header: t("columns.consumedQty"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {Math.max(0, row.original.produced_qty_kg - row.original.current_stock_kg)} kg
        </span>
      ),
    },
    {
      id: "costPerKg",
      header: t("columns.costPerKg"),
      cell: ({ row }) => {
        const perKg = costPerKg(row.original.produced_cost_tk, row.original.produced_qty_kg);
        return perKg != null ? (
          <span className="text-sm text-foreground">
            <MoneyText amount={perKg} />
            <span className="text-muted-foreground">/kg</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "totalCost",
      header: t("columns.totalCost"),
      cell: ({ row }) => <MoneyText amount={row.original.produced_cost_tk} className="text-sm font-medium text-foreground" />,
    },
    {
      id: "__actions__",
      header: t("columns.action"),
      size: 56,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Can I="feed.delete">
            <button
              type="button"
              onClick={() => onDelete(row.original)}
              aria-label={t("delete")}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </Can>
        </div>
      ),
    },
  ];
}

"use client"; // columns need client callbacks + DataTable

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@rakhal/ui/ui/avatar";
import { Chip } from "@rakhal/ui/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { DataTable } from "@/components/shared/data-table";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { avatarTint } from "../avatar-tint";
import { useMilkTankAuditLogInfiniteList, useMilkTanks, useTeamMembersMap } from "../hooks/use-inventory";
import type { MilkTankActivity, MilkTankAuditLogEntry } from "../types";

const ACTIVITY_CHIP_VARIANT: Record<MilkTankActivity, "primary" | "info" | "destructive" | "teal" | "muted"> = {
  COLLECTION: "primary",
  SALE: "info",
  ADJUSTMENT: "destructive",
  TRANSFER: "teal",
  CALF_ALLOCATION: "muted",
};

/**
 * "Milk Audit Log" — Figma 734:27983/734:27985 (`get_design_context` + screenshot of the real
 * mock's 6 columns: No/Date/Activity Type/Quantity/Storage/Operator). Backed by the real, cursor-only
 * `GET /inventory/milk-tanks/audit-log` (`milk-tank.service.ts#auditLog`) — same honest-frontier
 * infinite-scroll `InfiniteScrollFooter` pattern as Medicine/FeedItem rather than the mock's plain page-number look
 * being faked over an infinite list. "Storage" resolves `milkTankId` → the tank's own name (not a
 * shed) via a `includeArchived: true` tank fetch — a plain active-only list (what the tank grid
 * itself uses) would lose the name on any row whose tank has since been archived, since the audit
 * log intentionally never deletes history. "Operator" resolves `createdBy` via `useTeamMembersMap`
 * (`team.read`-gated, best-effort — see that hook's doc comment); an id that doesn't resolve (e.g.
 * viewer lacks `team.read`, or the actor since left the farm) falls back to a generic tinted-initial
 * avatar instead of blocking the row.
 */
export function MilkAuditLogTable() {
  const t = useTranslations("inventory.milk.auditLog");
  const query = useMilkTankAuditLogInfiniteList();
  const tanksQuery = useMilkTanks({ includeArchived: true });
  const teamMembers = useTeamMembersMap();

  const tankNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tank of tanksQuery.data ?? []) map.set(tank.id, tank.name);
    return map;
  }, [tanksQuery.data]);

  const startIndex = 0;

  const columns = useMemo<ColumnDef<MilkTankAuditLogEntry, unknown>[]>(
    () => [
      {
        id: "no",
        header: t("columns.no"),
        size: 48,
        cell: ({ row }) => <span className="text-muted-foreground">{String(startIndex + row.index + 1).padStart(2, "0")}</span>,
      },
      {
        id: "date",
        header: t("columns.date"),
        cell: ({ row }) => (
          <span className="flex flex-col">
            <DateText date={row.original.createdAt} className="text-sm font-medium text-foreground" />
            <DateText date={row.original.createdAt} options={{ hour: "numeric", minute: "2-digit" }} className="text-xs text-muted-foreground" />
          </span>
        ),
      },
      {
        id: "activityType",
        header: t("columns.activityType"),
        cell: ({ row }) => <Chip variant={ACTIVITY_CHIP_VARIANT[row.original.activityType]}>{t(`activityOptions.${row.original.activityType}`)}</Chip>,
      },
      {
        id: "quantity",
        header: t("columns.quantity"),
        cell: ({ row }) => {
          const qty = row.original.quantityL;
          return (
            <span className={cn("text-sm font-semibold", qty >= 0 ? "text-success" : "text-destructive")}>
              {qty >= 0 ? "+" : ""}
              {qty}L
            </span>
          );
        },
      },
      {
        id: "storage",
        header: t("columns.storage"),
        cell: ({ row }) => tankNameById.get(row.original.milkTankId) ?? "—",
      },
      {
        id: "operator",
        header: t("columns.operator"),
        cell: ({ row }) => {
          const member = teamMembers.get(row.original.createdBy);
          const name = member?.name ?? t("unknownOperator");
          return (
            <span className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarFallback className={avatarTint(row.original.createdBy)}>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground">{name}</span>
            </span>
          );
        },
      },
    ],
    [t, startIndex, tankNameById, teamMembers],
  );

  return (
    <div className="flex flex-col gap-4">
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
          data={query.items}
          getRowId={(row) => row.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          emptyState={{ title: t("empty.title"), description: t("empty.description") }}
        />
      </div>
      {!query.isLoading && !query.isError && query.items.length > 0 ? (
        <InfiniteScrollFooter
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          isError={query.isNextPageError}
          onLoadMore={query.fetchNextPage}
          loadedCount={query.items.length}
        />
      ) : null}
    </div>
  );
}

"use client"; // no interactivity of its own, but matches sibling tab components' "use client" convention

import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import type { SafetyWithdrawalListItem } from "../types";

/** Safety Withdrawals tab (no Figma frame — `GET /health/safety-withdrawals` had zero frontend
 * consumer despite the route existing; same raw-`<table>` convention as `SickBayTable`). Shows
 * every withdrawal (active + completed, farm-wide) with the milk/meat clear dates so a
 * manager/owner can see at a glance which animals are still under a milk/meat hold. */
export function SafetyWithdrawalTable({
  items,
  isLoading,
  isError,
  onRetry,
}: {
  items: SafetyWithdrawalListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("health.safetyWithdrawals");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState description={t("error")} onRetry={onRetry} />;
  if (items.length === 0) return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-muted">
          <tr>
            {["name", "milkUntil", "meatUntil", "status"].map((col) => (
              <th key={col} className="h-[54px] px-2 text-left text-sm font-medium text-muted-foreground">
                {t(`columns.${col}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    {item.cattle.image ? <AvatarImage src={item.cattle.image} alt="" /> : null}
                    <AvatarFallback>{(item.cattle.name ?? item.cattle.tagNumber).slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-foreground">{item.cattle.name ?? item.cattle.tagNumber}</p>
                    <p className="text-xs text-muted-foreground">{item.cattle.tagNumber}</p>
                  </div>
                </div>
              </td>
              <td className="px-2 py-2 text-sm text-foreground">
                {item.milkWithdrawalUntil ? <DateText date={item.milkWithdrawalUntil} /> : "—"}
              </td>
              <td className="px-2 py-2 text-sm text-foreground">
                {item.meatWithdrawalUntil ? <DateText date={item.meatWithdrawalUntil} /> : "—"}
              </td>
              <td className="px-2 py-2">
                <Chip variant={item.status === "ACTIVE" ? "destructive" : "primary"}>
                  {t(`statusOptions.${item.status}`)}
                </Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client"; // no interactivity of its own, but matches sibling tab components' "use client" convention

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useReleaseWithdrawal } from "../hooks/use-health";
import type { SafetyWithdrawalListItem, SafetyWithdrawalStatus } from "../types";

const STATUS_CHIP_VARIANT: Record<SafetyWithdrawalStatus, NonNullable<ChipProps["variant"]>> = {
  ACTIVE: "warning",
  READY_FOR_RELEASE: "info",
  RELEASED: "muted",
  CANCELLED: "muted",
};

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
  const release = useReleaseWithdrawal();

  async function handleRelease(id: string) {
    try {
      await release.mutateAsync(id);
      toast.success(t("releasedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

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
            {["name", "milkUntil", "meatUntil", "status", "action"].map((col) => (
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
                <Chip variant={STATUS_CHIP_VARIANT[item.status]}>{t(`statusOptions.${item.status}`)}</Chip>
              </td>
              <td className="px-2 py-2">
                {item.status === "READY_FOR_RELEASE" ? (
                  <Can I="healthcare.update">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRelease(item.id)}
                      disabled={release.isPending}
                    >
                      {t("release")}
                    </Button>
                  </Can>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client"; // no interactivity of its own, but matches sibling tab components' "use client" convention

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@rakhal/ui/ui/avatar";
import { Button } from "@rakhal/ui/ui/button";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { AnimalLink } from "@/components/shared/animal-link";
import { useReleaseWithdrawal } from "../hooks/use-health";
import type { SafetyWithdrawalListItem, SafetyWithdrawalStatus } from "../types";

const STATUS_CHIP_VARIANT: Record<SafetyWithdrawalStatus, NonNullable<ChipProps["variant"]>> = {
  ACTIVE: "warning",
  READY_FOR_RELEASE: "info",
  RELEASED: "muted",
  CANCELLED: "muted",
};

/** ACTIVE or READY_FOR_RELEASE = still withholding milk/meat right now (RFE-110's "under a hold"). */
function isUnderHold(status: SafetyWithdrawalStatus): boolean {
  return status === "ACTIVE" || status === "READY_FOR_RELEASE";
}

function Countdown({ daysRemaining, until, t }: { daysRemaining: number | null; until: string | null; t: ReturnType<typeof useTranslations> }) {
  if (!until) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-foreground">
        {daysRemaining === null ? "—" : t("daysRemaining", { count: daysRemaining })}
      </span>
      <span className="text-xs text-muted-foreground">
        <DateText date={until} />
      </span>
    </div>
  );
}

/** Safety Withdrawals table — no longer a standalone tab (RFE-110 folded it into the Treatments
 * tab's "Withholding" section, see `safety-withdrawal-tab.tsx`). Gained RAKHAL-420's three fields:
 * which medicine caused the hold, the case it came from, and a server-computed days-remaining
 * countdown (`health.service.ts#daysRemaining`) instead of a bare date the reader had to diff
 * themselves. A row still `isUnderHold` gets a red "Withholding" badge next to its name — the
 * milk-room question ("who can't go in the tank today") answerable at a glance, not just from the
 * Status column's word. */
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
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead className="bg-muted">
          <tr>
            {["name", "medicine", "case", "milkUntil", "meatUntil", "status", "action"].map((col) => (
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
                  <AnimalLink
                    id={item.cattle.id}
                    animalName={item.cattle.name}
                    tagNumber={item.cattle.tagNumber}
                    className="flex items-center gap-2 text-left group font-normal"
                  >
                    <Avatar className="size-8">
                      {item.cattle.image ? <AvatarImage src={item.cattle.image} alt="" /> : null}
                      <AvatarFallback>{(item.cattle.name ?? item.cattle.tagNumber).slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-foreground group-hover:underline">{item.cattle.name ?? item.cattle.tagNumber}</p>
                      <p className="text-xs text-muted-foreground">{item.cattle.tagNumber}</p>
                    </div>
                  </AnimalLink>
                  {isUnderHold(item.status) ? (
                    <Chip variant="destructive" subtle className="px-2 py-0.5 text-xs">
                      {t("underHold")}
                    </Chip>
                  ) : null}
                </div>
              </td>
              <td className="px-2 py-2 text-sm text-foreground">{item.medicineName ?? "—"}</td>
              <td className="px-2 py-2 text-sm text-muted-foreground">{item.caseCode}</td>
              <td className="px-2 py-2">
                <Countdown daysRemaining={item.milkDaysRemaining} until={item.milkWithdrawalUntil} t={t} />
              </td>
              <td className="px-2 py-2">
                <Countdown daysRemaining={item.meatDaysRemaining} until={item.meatWithdrawalUntil} t={t} />
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

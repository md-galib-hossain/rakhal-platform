"use client"; // filter toggle state + refresh mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { useRefreshSafetyWithdrawals, useSafetyWithdrawalsPagedList } from "../hooks/use-health";
import { SafetyWithdrawalTable } from "./safety-withdrawal-table";

const FILTERS = ["withholding", "all"] as const;
type Filter = (typeof FILTERS)[number];

/** Safety Withdrawals — real `GET /health/safety-withdrawals` + `POST .../refresh`
 * (`healthcare.update`, manager+). RFE-110: **no longer a standalone tab** — was `SafetyWithdrawalTab`, folded into the
 * Treatments tab behind a "Withholding"/"All" toggle. **RFE-141**: it is now the Sick Bay tab's "Withheld" view — the
 * only list on screen when selected — and it pages (`useSafetyWithdrawalsPagedList`) instead of showing the first 20
 * rows of "All" with no way to reach the rest. An animal whose case is closed can still be inside a withdrawal period,
 * so this view cannot be derived from the Sick Bay list.
 * Default view is `activeOnly=true` (RAKHAL-420) — the milk-room question ("who can't go in the tank today"), not the
 * full history; "All" switches to the unfiltered list (released/cancelled included).
 * "Refresh" clears any withdrawal whose milk/meat date has passed (`refreshSafetyWithdrawalsForFarm`) — normally
 * happens automatically on read paths server-side, this is a manual trigger so a manager can force it and see the count
 * of newly-cleared rows. Per-row release works as before. */
export function SafetyWithdrawalSection({
  hideFilterSwitch = false,
  filter: controlledFilter,
  onFilterChange,
}: {
  hideFilterSwitch?: boolean;
  filter?: Filter;
  onFilterChange?: (filter: Filter) => void;
}) {
  const t = useTranslations("health.safetyWithdrawals");
  const [internalFilter, setInternalFilter] = useState<Filter>("withholding");
  const filter = controlledFilter ?? internalFilter;
  const list = useSafetyWithdrawalsPagedList(filter === "withholding" ? { activeOnly: true } : {});
  const refresh = useRefreshSafetyWithdrawals();

  function handleFilterSelect(key: Filter) {
    if (onFilterChange) {
      onFilterChange(key);
    } else {
      setInternalFilter(key);
    }
  }

  async function handleRefresh() {
    try {
      const result = await refresh.mutateAsync();
      toast.success(t("refreshedToast", { count: result.updated }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("flex flex-wrap items-center gap-3", hideFilterSwitch ? "justify-end" : "justify-between")}>
        {!hideFilterSwitch && (
          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleFilterSelect(key)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  filter === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`filter.${key}`)}
              </button>
            ))}
          </div>
        )}
        <Can I="healthcare.update">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void handleRefresh()} disabled={refresh.isPending}>
            <RefreshCw className="size-4" aria-hidden />
            {refresh.isPending ? "…" : t("refresh")}
          </Button>
        </Can>
      </div>
      <SafetyWithdrawalTable items={list.items} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()} />
      {list.totalPages > 1 ? (
        <Pagination
          page={list.page}
          totalPages={list.totalPages}
          onPageChange={list.goToPage}
          isFetching={list.isFetching}
          pageSize={list.pageSize}
          onPageSizeChange={list.setPageSize}
        />
      ) : null}
    </div>
  );
}

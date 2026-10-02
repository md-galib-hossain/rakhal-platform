"use client"; // filter toggle state + refresh mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useRefreshSafetyWithdrawals, useSafetyWithdrawals } from "../hooks/use-health";
import { SafetyWithdrawalTable } from "./safety-withdrawal-table";
import { WITHDRAWALS_SECTION_ID } from "./attention-strip";

const FILTERS = ["withholding", "all"] as const;
type Filter = (typeof FILTERS)[number];

/** Safety Withdrawals — real `GET /health/safety-withdrawals` + `POST .../refresh`
 * (`healthcare.update`, manager+). RFE-110: **no longer a standalone tab** — was `SafetyWithdrawalTab`,
 * rendered as a 4th peer tab; now an embeddable section rendered inside `TreatmentsTab` (RFE-107's
 * 3-tab shell), reached via a "Withholding"/"All" filter toggle instead of its own nav entry.
 * Default view is `activeOnly=true` (RAKHAL-420) — the milk-room question ("who can't go in the tank
 * today"), not the full history; "All" switches to the unfiltered list (released/cancelled included).
 * "Refresh" clears any withdrawal whose milk/meat date has passed (`refreshSafetyWithdrawalsForFarm`)
 * — normally happens automatically on read paths server-side, this is a manual trigger so a manager
 * can force it and see the count of newly-cleared rows. Capability is unchanged from the old standalone
 * tab — filter, refresh, and per-row release all still work, just relocated. */
export function SafetyWithdrawalSection() {
  const t = useTranslations("health.safetyWithdrawals");
  const [filter, setFilter] = useState<Filter>("withholding");
  const query = useSafetyWithdrawals(filter === "withholding" ? { activeOnly: true } : {});
  const refresh = useRefreshSafetyWithdrawals();

  // "All" has no server-side active count on this page alone (cursor-paginated, same known
  // limitation the round search in `treatments-tab.tsx` already documents) — good enough for a
  // header badge, not relied on for anything load-bearing.
  const items = query.data?.items ?? [];
  const holdCount =
    filter === "withholding" ? items.length : items.filter((i) => i.status === "ACTIVE" || i.status === "READY_FOR_RELEASE").length;

  async function handleRefresh() {
    try {
      const result = await refresh.mutateAsync();
      toast.success(t("refreshedToast", { count: result.updated }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <div id={WITHDRAWALS_SECTION_ID} className="flex scroll-mt-4 flex-col gap-3 border-t border-dashed border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">{t("title")}</h3>
          {holdCount > 0 ? (
            <Chip variant="destructive" subtle>
              {holdCount}
            </Chip>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  filter === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`filter.${key}`)}
              </button>
            ))}
          </div>
          <Can I="healthcare.update">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void handleRefresh()} disabled={refresh.isPending}>
              <RefreshCw className="size-4" aria-hidden />
              {refresh.isPending ? "…" : t("refresh")}
            </Button>
          </Can>
        </div>
      </div>
      <SafetyWithdrawalTable
        items={items}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      />
    </div>
  );
}

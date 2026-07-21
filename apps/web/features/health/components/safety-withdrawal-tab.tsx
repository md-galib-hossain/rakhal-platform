"use client"; // status filter state + refresh mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRefreshSafetyWithdrawals, useSafetyWithdrawals } from "../hooks/use-health";
import { SafetyWithdrawalTable } from "./safety-withdrawal-table";

const ALL = "__all__";

/** Safety Withdrawals tab (`healthcare.read`) of the Health Management Center — real
 * `GET /health/safety-withdrawals` + `POST .../refresh` (`healthcare.update`, manager+), previously
 * unwired anywhere in the frontend. "Refresh" clears any withdrawal whose milk/meat date has passed
 * (`refreshSafetyWithdrawalsForFarm`) — normally happens automatically on read paths server-side, this
 * is a manual trigger so a manager can force it and see the count of newly-cleared rows. */
export function SafetyWithdrawalTab() {
  const t = useTranslations("health.safetyWithdrawals");
  const [status, setStatus] = useState<"ACTIVE" | "COMPLETED" | typeof ALL>(ALL);
  const query = useSafetyWithdrawals(status === ALL ? {} : { status });
  const refresh = useRefreshSafetyWithdrawals();

  async function handleRefresh() {
    try {
      const result = await refresh.mutateAsync();
      toast.success(t("refreshedToast", { count: result.updated }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-44" aria-label={t("columns.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("statusOptions.ALL")}</SelectItem>
            <SelectItem value="ACTIVE">{t("statusOptions.ACTIVE")}</SelectItem>
            <SelectItem value="COMPLETED">{t("statusOptions.COMPLETED")}</SelectItem>
          </SelectContent>
        </Select>
        <Can I="healthcare.update">
          <Button variant="outline" className="gap-2" onClick={() => void handleRefresh()} disabled={refresh.isPending}>
            <RefreshCw className="size-4" aria-hidden />
            {refresh.isPending ? "…" : t("refresh")}
          </Button>
        </Can>
      </div>
      <SafetyWithdrawalTable
        items={query.data?.items ?? []}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      />
    </div>
  );
}

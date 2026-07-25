"use client"; // live queries + dialog state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Can } from "@/lib/auth/permissions";
import { cattleApi } from "@/features/cattle/api";
import { useProtocolInstances, useProtocols } from "../../hooks/use-reproduction";
import { ReproductionCard } from "../reproduction-card";
import { ApplyProtocolDialog } from "./apply-protocol-dialog";
import { ProtocolInstanceActions } from "./protocol-instance-actions";

/** Reproductive (Synchronization) Protocols (RAKHAL-214, PRD §9.8/§9.9) — compact panel, not a full
 * detail page: protocol cards with their own conception-rate metrics, an "Apply protocol" action,
 * and the farm's active instances with per-row lifecycle actions. No Figma frame for this module.
 * Instance rows resolve `cattle_id` → name/tag via a per-row `cattleApi.findOne` lookup (the
 * backend's `mapInstance` doesn't join it itself) instead of showing the raw id, since an
 * unauthorized-looking id string is not a "if UI-feasible" state worth shipping as-is. */
export function ProtocolsPanel() {
  const t = useTranslations("reproduction.protocols");
  const protocols = useProtocols();
  const instances = useProtocolInstances({ status: "IN_PROGRESS" });
  const [applyOpen, setApplyOpen] = useState(false);

  return (
    <ReproductionCard
      title={t("title")}
      headerRight={
        <Can I="reproduction.create">
          <Button size="sm" onClick={() => setApplyOpen(true)}>
            {t("applyProtocol")}
          </Button>
        </Can>
      }
    >
      {protocols.isLoading ? (
        <CardSkeleton lines={3} />
      ) : protocols.isError ? (
        <ErrorState description={t("error")} onRetry={() => protocols.refetch()} />
      ) : (protocols.data?.length ?? 0) === 0 ? (
        <EmptyState title={t("emptyProtocols")} className="py-6" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {protocols.data?.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-1.5 rounded-xl border border-border p-3 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{p.name}</span>
                {p.is_system_default ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {t("systemDefault")}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{t("durationDays", { value: p.duration_days })}</p>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-info-tint px-2 py-0.5 font-medium text-info">
                  {t("applied", { value: p.metrics.applied })}
                </span>
                <span className="rounded-full bg-warning-tint px-2 py-0.5 font-medium text-warning">
                  {t("inProgress", { value: p.metrics.in_progress })}
                </span>
                <span className="rounded-full bg-success-tint px-2 py-0.5 font-medium text-success">
                  {t("conceptionRate", { value: p.metrics.conception_rate ?? "—" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{t("activeInstances")}</p>
        {instances.isLoading ? (
          <CardSkeleton lines={2} />
        ) : instances.isError ? (
          <ErrorState description={t("error")} onRetry={() => instances.refetch()} />
        ) : (instances.data?.items?.length ?? 0) === 0 ? (
          <EmptyState title={t("emptyInstances")} className="py-6" />
        ) : (
          <div className="flex flex-col">
            {instances.data?.items?.map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0"
              >
                <div className="flex flex-col gap-0.5">
                  <InstanceCowLabel cattleId={instance.cattle_id} />
                  <span className="text-xs text-muted-foreground">
                    {instance.protocol_name} · {t("currentStepDay", { value: instance.current_step_day })}
                  </span>
                </div>
                <Can I="reproduction.update">
                  <ProtocolInstanceActions instance={instance} />
                </Can>
              </div>
            ))}
          </div>
        )}
      </div>

      <ApplyProtocolDialog open={applyOpen} onOpenChange={setApplyOpen} />
    </ReproductionCard>
  );
}

/** Resolves a protocol instance's `cattle_id` to a name/tag via `GET /cattle/:id` (cached — the
 * same cow shows up across multiple instances/renders). Falls back to a shortened id if the lookup
 * 404s/fails rather than blocking the row. */
function InstanceCowLabel({ cattleId }: { cattleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cattle-lookup", cattleId],
    queryFn: () => cattleApi.findOne(cattleId),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) {
    return <span className="h-4 w-24 animate-pulse rounded bg-muted" />;
  }
  if (!data) {
    return <span className="font-mono text-sm text-foreground">{cattleId.slice(0, 10)}…</span>;
  }
  return (
    <span className="text-sm font-medium text-foreground">
      {data.name ?? data.tagNumber}
      {data.name ? <span className="font-normal text-muted-foreground"> {data.tagNumber}</span> : null}
    </span>
  );
}

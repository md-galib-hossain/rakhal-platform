"use client"; // live queries + dialog state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Can } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/errors";
import { cattleApi } from "@/features/cattle/api";
import { AnimalLink } from "@/components/shared/animal-link";
import { useDeleteProtocol, useProtocolInstances, useProtocols } from "../../hooks/use-reproduction";
import { ReproductionCard } from "../reproduction-card";
import { ApplyProtocolDialog } from "./apply-protocol-dialog";
import { ProtocolDetailSheet } from "./protocol-detail-sheet";
import { ProtocolFormDialog } from "./protocol-form-dialog";
import { ProtocolInstanceActions } from "./protocol-instance-actions";
import { ProtocolInstanceTimeline } from "./protocol-instance-timeline";
import type { ProtocolInstance, ProtocolInstanceStatus, ProtocolSummary } from "../../types";

const INSTANCE_TABS = ["IN_PROGRESS", "COMPLETED", "CANCELLED", "FAILED", "ALL"] as const;
type InstanceTab = (typeof INSTANCE_TABS)[number];

const STATUS_VARIANT: Record<ProtocolInstanceStatus, ChipProps["variant"]> = {
  DRAFT: "muted",
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "teal",
  CANCELLED: "muted",
  FAILED: "destructive",
};

/** Reproductive (Synchronization) Protocols (RAKHAL-214, PRD §9.8/§9.9) — compact panel, not a full
 * detail page: protocol cards with their own conception-rate metrics, an "Apply protocol" action,
 * and the farm's active instances with per-row lifecycle actions. No Figma frame for this module.
 * Instance rows resolve `cattle_id` → name/tag via a per-row `cattleApi.findOne` lookup (the
 * backend's `mapInstance` doesn't join it itself) instead of showing the raw id, since an
 * unauthorized-looking id string is not a "if UI-feasible" state worth shipping as-is. */
export function ProtocolsPanel() {
  const t = useTranslations("reproduction.protocols");
  const protocols = useProtocols();
  const [instanceTab, setInstanceTab] = useState<InstanceTab>("IN_PROGRESS");
  const instances = useProtocolInstances(
    instanceTab === "ALL" ? {} : { status: instanceTab },
  );
  const [applyOpen, setApplyOpen] = useState(false);
  const [timelineInstance, setTimelineInstance] = useState<ProtocolInstance | null>(null);
  const [detailProtocol, setDetailProtocol] = useState<ProtocolSummary | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingProtocolId, setEditingProtocolId] = useState<string | undefined>(undefined);
  const [deletingProtocol, setDeletingProtocol] = useState<{ id: string; name: string } | null>(null);
  const deleteProtocol = useDeleteProtocol();
  const protocolRows = useMemo(() => protocols.data?.pages.flatMap((p) => p.items) ?? [], [protocols.data]);
  const instanceRows = useMemo(() => instances.data?.pages.flatMap((p) => p.items) ?? [], [instances.data]);

  function openCreate() {
    setEditingProtocolId(undefined);
    setFormDialogOpen(true);
  }
  function openEdit(id: string) {
    setEditingProtocolId(id);
    setFormDialogOpen(true);
  }
  async function confirmDelete() {
    if (!deletingProtocol) return;
    try {
      await deleteProtocol.mutateAsync(deletingProtocol.id);
      toast.success(t("deletedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    }
  }

  return (
    <ReproductionCard
      title={t("title")}
      headerRight={
        <div className="flex items-center gap-2">
          <Can I="reproduction.create">
            <Button size="sm" variant="secondary" onClick={openCreate}>
              {t("newProtocol")}
            </Button>
          </Can>
          <Can I="reproduction.create">
            <Button size="sm" onClick={() => setApplyOpen(true)}>
              {t("applyProtocol")}
            </Button>
          </Can>
        </div>
      }
    >
      {protocols.isLoading ? (
        <CardSkeleton lines={3} />
      ) : protocols.isError ? (
        <ErrorState description={t("error")} onRetry={() => protocols.refetch()} />
      ) : protocolRows.length === 0 ? (
        <EmptyState title={t("emptyProtocols")} className="py-6" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {protocolRows.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailProtocol(p)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDetailProtocol(p);
                }
              }}
              className="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{p.name}</span>
                {p.is_system_default ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {t("systemDefault")}
                  </span>
                ) : p.editable ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Can I="reproduction.update">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(p.id);
                        }}
                        aria-label={t("edit")}
                        className="flex size-6 items-center justify-center rounded text-muted-foreground transition-opacity hover:opacity-70"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                    </Can>
                    <Can I="reproduction.delete">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProtocol({ id: p.id, name: p.name });
                        }}
                        aria-label={t("deleteAction")}
                        className="flex size-6 items-center justify-center rounded text-destructive transition-opacity hover:opacity-70"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </Can>
                  </div>
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
      {protocols.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="ghost"
            disabled={protocols.isFetchingNextPage}
            onClick={() => void protocols.fetchNextPage()}
          >
            {protocols.isFetchingNextPage ? t("loading") : t("loadMore")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{t("activeInstances")}</p>
          <Tabs
            value={instanceTab}
            onValueChange={(value) => setInstanceTab(value as InstanceTab)}
          >
            <TabsList>
              {INSTANCE_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {t(`instanceTabs.${tab}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {instances.isLoading ? (
          <CardSkeleton lines={2} />
        ) : instances.isError ? (
          <ErrorState description={t("error")} onRetry={() => instances.refetch()} />
        ) : instanceRows.length === 0 ? (
          <EmptyState title={t(`instanceTabs.empty.${instanceTab}`)} className="py-6" />
        ) : (
          <div className="flex flex-col">
            {instanceRows.map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0"
              >
                <div className="flex flex-col gap-0.5">
                  <InstanceCowLabel cattleId={instance.cattle_id} />
                  <span className="text-xs text-muted-foreground">
                    {instance.protocol_name} ·{" "}
                    {instance.status === "CANCELLED" || instance.status === "FAILED"
                      ? (instance.end_reason ?? t(`statusValue.${instance.status}`))
                      : instance.status === "COMPLETED"
                        ? t(`pregnancyOutcome.${instance.pregnancy_outcome ?? "WAITING_PD"}`)
                        : t("currentStepDay", { value: instance.current_step_day })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Chip variant={STATUS_VARIANT[instance.status]} className="shrink-0">
                    {t(`statusValue.${instance.status}`)}
                  </Chip>
                  <Button size="sm" variant="ghost" onClick={() => setTimelineInstance(instance)}>
                    {t("viewTimeline")}
                  </Button>
                  <Can I="reproduction.update">
                    <ProtocolInstanceActions instance={instance} />
                  </Can>
                </div>
              </div>
            ))}
          </div>
        )}
        {instances.hasNextPage ? (
          <div className="flex justify-center">
            <Button
              size="sm"
              variant="ghost"
              disabled={instances.isFetchingNextPage}
              onClick={() => void instances.fetchNextPage()}
            >
              {instances.isFetchingNextPage ? t("loading") : t("loadMore")}
            </Button>
          </div>
        ) : null}
      </div>

      <ApplyProtocolDialog open={applyOpen} onOpenChange={setApplyOpen} />
      <ProtocolFormDialog open={formDialogOpen} onOpenChange={setFormDialogOpen} protocolId={editingProtocolId} />
      <ConfirmDialog
        open={deletingProtocol !== null}
        onOpenChange={(next) => {
          if (!next) setDeletingProtocol(null);
        }}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("deleteAction")}
        onConfirm={confirmDelete}
      />
      <ProtocolInstanceTimeline
        instance={timelineInstance}
        open={timelineInstance !== null}
        onOpenChange={(next) => {
          if (!next) setTimelineInstance(null);
        }}
      />
      <ProtocolDetailSheet
        protocol={detailProtocol}
        open={detailProtocol !== null}
        onOpenChange={(next) => {
          if (!next) setDetailProtocol(null);
        }}
      />
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
    <AnimalLink
      id={cattleId}
      animalName={data.name}
      tagNumber={data.tagNumber}
      className="text-sm font-medium text-foreground hover:text-primary"
    >
      {data.name ?? data.tagNumber}
      {data.name ? <span className="font-normal text-muted-foreground"> {data.tagNumber}</span> : null}
    </AnimalLink>
  );
}

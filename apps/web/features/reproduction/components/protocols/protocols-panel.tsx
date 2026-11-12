"use client"; // live queries + view / dialog state

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateText } from "@/components/shared/date-text";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useIncrementalReveal } from "@/lib/hooks/use-incremental-reveal";
import { Can, useCan } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { cattleApi } from "@/features/cattle/api";
import { useInfiniteCursorList } from "@/lib/hooks/use-infinite-cursor-list";
import { qk } from "@/lib/query/keys";
import { reproductionApi } from "../../api";
import { useDeleteProtocol, useProtocolInstances, useProtocols } from "../../hooks/use-reproduction";
import { ReproductionCard } from "../reproduction-card";
import { ReproductionCowIdentity } from "../reproduction-cow-identity";
import { ApplyProtocolDialog } from "./apply-protocol-dialog";
import { ProtocolDetailSheet } from "./protocol-detail-sheet";
import { ProtocolFormDialog } from "./protocol-form-dialog";
import { ProtocolInstanceActions } from "./protocol-instance-actions";
import { ProtocolProgress } from "./protocol-progress";
import { ProtocolInstanceTimeline } from "./protocol-instance-timeline";
import type { ProtocolInstance, ProtocolInstanceStatus, ProtocolSummary } from "../../types";

type View = "running" | "library";

/** "ACTIVE" is a UI-only tab: the list endpoint filters by ONE status, and a protocol applied with a
 * future start date is `SCHEDULED`, not `IN_PROGRESS` — under the old "In Progress" tab those cows
 * were invisible until you found "All". Active merges both. */
const INSTANCE_TABS = ["ACTIVE", "COMPLETED", "CANCELLED", "FAILED", "ALL"] as const;
type InstanceTab = (typeof INSTANCE_TABS)[number];

/** Every list in this card is paged (5 cow rows / 2 template cards by default) so the card keeps a steady
 * height beside its partner and a long history never becomes a long scroll. The pager always shows,
 * like the events feed's, so the control is where you expect it even when everything fits one page. */
/** Rows revealed / fetched per scroll step. */
const INSTANCE_STEP = 10;
const LIBRARY_STEP = 6;

const STATUS_VARIANT: Record<ProtocolInstanceStatus, ChipProps["variant"]> = {
  DRAFT: "muted",
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "teal",
  CANCELLED: "muted",
  FAILED: "destructive",
};

/** Whole local calendar days from `iso` to today (negative = in the future). */
function daysSince(iso: string): number {
  const start = new Date(iso);
  const now = new Date();
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Drives the section's `InfiniteScrollFooter` — a server cursor for history, a client reveal for the
 * small in-flight set. */
interface InstanceMore {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  onLoadMore: () => void;
  /** Set only for server-cursor lists; enables the "All N loaded" note. */
  loadedCount?: number;
}

interface InstanceResult {
  /** The rows loaded / revealed so far. */
  rows: ProtocolInstance[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  more: InstanceMore;
}

/** Reproductive (Synchronization) Protocols (RAKHAL-214, PRD §9.8/§9.9). Two views instead of one
 * long card that mixed a template catalogue with live work:
 *  - **Cows on protocol** (default — the day-to-day view): one row per instance with real progress
 *    ("Day 3 of 10"), a single next-step button, and Timeline / Cancel-Fail tucked in a ⋯ menu.
 *  - **Protocol library**: the templates, each with its own stats, "View steps" and a one-tap "Apply".
 * No Figma frame for this module. Instance rows resolve `cattle_id` → name/tag via a per-row
 * `cattleApi.findOne` lookup (the backend's `mapInstance` doesn't join it itself). */
export function ProtocolsPanel() {
  const t = useTranslations("reproduction.protocols");
  const protocols = useProtocols();
  const [view, setView] = useState<View>("running");
  const [instanceTab, setInstanceTab] = useState<InstanceTab>("ACTIVE");
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyProtocolId, setApplyProtocolId] = useState<string | undefined>(undefined);
  const [timelineInstance, setTimelineInstance] = useState<ProtocolInstance | null>(null);
  const [detailProtocol, setDetailProtocol] = useState<ProtocolSummary | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingProtocolId, setEditingProtocolId] = useState<string | undefined>(undefined);
  const [deletingProtocol, setDeletingProtocol] = useState<{ id: string; name: string } | null>(null);
  const deleteProtocol = useDeleteProtocol();
  const protocolRows = useMemo(() => protocols.data?.pages.flatMap((p) => p.items) ?? [], [protocols.data]);

  // The catalogue is short (a handful of templates) and the running view needs every protocol's
  // duration for its progress bars, so pull all pages instead of hiding some behind "Load more".
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = protocols;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // The catalogue is fetched whole (above), so the library reveals rows already held.
  const libraryReveal = useIncrementalReveal(protocolRows, LIBRARY_STEP);
  const libraryShown = libraryReveal.visible;

  const durations = useMemo(() => new Map(protocolRows.map((p) => [p.id, p.duration_days])), [protocolRows]);

  function openApply(protocolId?: string) {
    setApplyProtocolId(protocolId);
    setApplyOpen(true);
  }
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
      description={t("description")}
      className="h-full min-h-[34rem]"
      headerRight={
        <>
          {view === "library" ? (
            <Can I="reproduction.create">
              <Button size="sm" variant="secondary" onClick={openCreate}>
                {t("newProtocol")}
              </Button>
            </Can>
          ) : null}
          <Can I="reproduction.create">
            <Button size="sm" onClick={() => openApply()}>
              {t("applyProtocol")}
            </Button>
          </Can>
        </>
      }
    >
      <Tabs value={view} onValueChange={(next) => setView(next as View)} className="flex flex-1 flex-col gap-4">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="running" className="flex-1 sm:flex-none">
            {t("views.running")}
          </TabsTrigger>
          <TabsTrigger value="library" className="flex-1 sm:flex-none">
            {t("views.library")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="running" className="mt-0 flex flex-1 flex-col gap-3">
          <Tabs value={instanceTab} onValueChange={(next) => setInstanceTab(next as InstanceTab)}>
            <TabsList aria-label={t("activeInstances")} className="w-full sm:w-fit overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {INSTANCE_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="shrink-0">
                  {t(`instanceTabs.${tab}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {instanceTab === "ACTIVE" ? (
            <ActiveInstances durations={durations} onApply={() => openApply()} onTimeline={setTimelineInstance} />
          ) : (
            <StatusInstances
              tab={instanceTab}
              durations={durations}
              onApply={() => openApply()}
              onTimeline={setTimelineInstance}
            />
          )}
        </TabsContent>

        <TabsContent value="library" className="mt-0 flex flex-1 flex-col">
          {protocols.isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : protocols.isError ? (
            <ErrorState description={t("error")} onRetry={() => protocols.refetch()} />
          ) : protocolRows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t("emptyProtocols")}
              className="py-8"
              action={
                <Can I="reproduction.create">
                  <Button size="sm" variant="secondary" onClick={openCreate}>
                    {t("newProtocol")}
                  </Button>
                </Can>
              }
            />
          ) : (
            <div className="flex flex-1 flex-col gap-4">
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
              {libraryShown.map((p) => (
                <ProtocolCard
                  key={p.id}
                  protocol={p}
                  onViewSteps={() => setDetailProtocol(p)}
                  onApply={() => openApply(p.id)}
                  onEdit={() => openEdit(p.id)}
                  onDelete={() => setDeletingProtocol({ id: p.id, name: p.name })}
                />
              ))}
            </ul>
              <InfiniteScrollFooter
                hasNextPage={libraryReveal.hasMore}
                isFetchingNextPage={false}
                onLoadMore={libraryReveal.showMore}
                className="mt-auto"
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ApplyProtocolDialog open={applyOpen} onOpenChange={setApplyOpen} defaultProtocolId={applyProtocolId} />
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

// ---- Library ---------------------------------------------------------------

/** One template. Not a click-anywhere card any more (it nested edit/delete buttons inside a
 * `role="button"` and gave no hint it was clickable): explicit "View steps" + "Apply" buttons, and
 * Edit/Delete for a farm's own protocols in a ⋯ menu with proper tap targets. */
function ProtocolCard({
  protocol: p,
  onViewSteps,
  onApply,
  onEdit,
  onDelete,
}: {
  protocol: ProtocolSummary;
  onViewSteps: () => void;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("reproduction.protocols");
  const can = useCan();
  const showMenu = p.editable && !p.is_system_default && (can("reproduction.update") || can("reproduction.delete"));

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="break-words text-sm font-semibold text-foreground">{p.name}</h3>
          <p className="text-xs text-muted-foreground">{t("cardMeta", { days: p.duration_days, steps: p.step_count })}</p>
        </div>
        {p.is_system_default ? (
          <Chip variant="muted" subtle className="shrink-0 px-2 py-0.5 font-medium">
            {t("systemDefault")}
          </Chip>
        ) : showMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="-mr-1 -mt-1 size-9 shrink-0" aria-label={t("moreActions")}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Can I="reproduction.update">
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil className="size-4" aria-hidden />
                  {t("edit")}
                </DropdownMenuItem>
              </Can>
              <Can I="reproduction.delete">
                <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="size-4" aria-hidden />
                  {t("deleteAction")}
                </DropdownMenuItem>
              </Can>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5 text-center">
        <Stat label={t("stats.applied")} value={p.metrics.applied} />
        <Stat label={t("stats.running")} value={p.metrics.in_progress} />
        <Stat
          label={t("stats.conception")}
          value={p.metrics.conception_rate != null ? `${p.metrics.conception_rate}%` : "—"}
          muted={p.metrics.conception_rate == null}
        />
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onViewSteps}>
          {t("viewSteps")}
        </Button>
        <Can I="reproduction.create">
          <Button size="sm" variant="secondary" className="ml-auto" onClick={onApply}>
            {t("apply")}
          </Button>
        </Can>
      </div>
    </li>
  );
}

function Stat({ label, value, muted = false }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dd className={cn("text-base font-bold tabular-nums", muted ? "text-muted-foreground" : "text-foreground")}>{value}</dd>
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

// ---- Cows on protocol ------------------------------------------------------

interface SectionProps {
  durations: Map<string, number>;
  onApply: () => void;
  onTimeline: (instance: ProtocolInstance) => void;
}

/** Pulls every remaining page of a bounded list (the running / scheduled set is small) so it can be
 * paged client-side after merging two status queries. */
function useFetchAllPages(query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
}

/** Running + scheduled, merged (two list calls — the endpoint takes one status). Running rows first.
 * Both sets are bounded (only in-flight instances), so they are fetched whole and paged client-side. */
function ActiveInstances(props: SectionProps) {
  const running = useProtocolInstances({ status: "IN_PROGRESS" });
  const scheduled = useProtocolInstances({ status: "SCHEDULED" });
  useFetchAllPages(running);
  useFetchAllPages(scheduled);
  const all = useMemo(
    () => [
      ...(running.data?.pages.flatMap((p) => p.items) ?? []),
      ...(scheduled.data?.pages.flatMap((p) => p.items) ?? []),
    ],
    [running.data, scheduled.data],
  );
  const reveal = useIncrementalReveal(all, INSTANCE_STEP);
  const result: InstanceResult = {
    rows: reveal.visible,
    isLoading: running.isLoading || scheduled.isLoading,
    isError: running.isError || scheduled.isError,
    refetch: () => {
      void running.refetch();
      void scheduled.refetch();
    },
    more: {
      hasNextPage: reveal.hasMore,
      isFetchingNextPage: false,
      isError: false,
      onLoadMore: reveal.showMore,
    },
  };
  return <InstanceRows tab="ACTIVE" result={result} {...props} />;
}

/** Completed / Cancelled / Failed / All are history and grow without bound, so these use the real server
 * cursor (infinite scroll) rather than fetching everything. */
function StatusInstances({ tab, ...props }: SectionProps & { tab: InstanceTab }) {
  const filters = tab === "ALL" ? {} : { status: tab as ProtocolInstanceStatus };
  const pager = useInfiniteCursorList(
    // Prefix matches the lifecycle mutations' protocol-instance invalidation.
    qk.reproduction.protocolInstances({ status: filters.status }),
    (cursor, limit) => reproductionApi.protocolInstances(filters, cursor, limit),
    { pageSize: INSTANCE_STEP },
  );
  const result: InstanceResult = {
    rows: pager.items,
    isLoading: pager.isLoading,
    isError: pager.isError,
    refetch: () => void pager.refetch(),
    more: {
      hasNextPage: pager.hasNextPage,
      isFetchingNextPage: pager.isFetchingNextPage,
      isError: pager.isNextPageError,
      onLoadMore: pager.fetchNextPage,
      loadedCount: pager.items.length,
    },
  };
  return <InstanceRows tab={tab} result={result} {...props} />;
}

function InstanceRows({
  tab,
  result,
  durations,
  onApply,
  onTimeline,
}: SectionProps & { tab: InstanceTab; result: InstanceResult }) {
  const t = useTranslations("reproduction.protocols");

  if (result.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (result.isError) return <ErrorState description={t("error")} onRetry={result.refetch} />;
  if (result.rows.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t(`instanceTabs.empty.${tab}`)}
        description={tab === "ACTIVE" ? t("emptyRunningHint") : undefined}
        className="flex-1 justify-center py-8"
        action={
          tab === "ACTIVE" ? (
            <Can I="reproduction.create">
              <Button size="sm" onClick={onApply}>
                {t("applyProtocol")}
              </Button>
            </Can>
          ) : undefined
        }
      />
    );
  }
  const { more } = result;
  return (
    <div className="flex flex-1 flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {result.rows.map((instance) => (
          <InstanceRow
            key={instance.id}
            instance={instance}
            durationDays={durations.get(instance.protocol_id)}
            onTimeline={() => onTimeline(instance)}
          />
        ))}
      </ul>
      <InfiniteScrollFooter
        hasNextPage={more.hasNextPage}
        isFetchingNextPage={more.isFetchingNextPage}
        isError={more.isError}
        onLoadMore={more.onLoadMore}
        loadedCount={more.loadedCount}
        className="mt-auto"
      />
    </div>
  );
}

/** One cow on one protocol: who + which protocol/when it started, where it is in the plan (a real
 * "Day 3 of 10" bar computed from the start date — `current_step_day` is the *first step's* day and
 * never advances, so it read "Day 0" for every cow), and the status with its next-step action. */
function InstanceRow({
  instance,
  durationDays,
  onTimeline,
}: {
  instance: ProtocolInstance;
  durationDays: number | undefined;
  onTimeline: () => void;
}) {
  const t = useTranslations("reproduction.protocols");
  const elapsed = daysSince(instance.start_date);
  const day = Math.max(0, durationDays ? Math.min(elapsed, durationDays) : elapsed);
  const scheduledAhead = instance.status === "SCHEDULED" && elapsed < 0;

  let progress: React.ReactNode;
  if (scheduledAhead) {
    progress = durationDays ? (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-info">{t("startsIn", { value: Math.abs(elapsed) })}</span>
        <ProtocolProgress day={0} total={durationDays} hideSummary />
      </div>
    ) : (
      <span className="text-xs font-semibold text-info">{t("startsIn", { value: Math.abs(elapsed) })}</span>
    );
  } else if (instance.status === "IN_PROGRESS" || instance.status === "DRAFT" || instance.status === "SCHEDULED") {
    progress = durationDays ? (
      <ProtocolProgress day={day} total={durationDays} aiDone={Boolean(instance.ai_completed_at)} />
    ) : (
      <span className="text-xs font-semibold text-foreground">{t("dayOnly", { day })}</span>
    );
  } else if (instance.status === "COMPLETED") {
    progress = (
      <span className="text-xs text-muted-foreground">{t(`pregnancyOutcome.${instance.pregnancy_outcome ?? "WAITING_PD"}`)}</span>
    );
  } else {
    progress = (
      <span className="text-xs text-muted-foreground">{instance.end_reason ?? t(`statusValue.${instance.status}`)}</span>
    );
  }

  return (
    <li className="grid gap-x-6 gap-y-3 py-4 first:pt-1 last:pb-1 md:grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)_auto] md:items-center">
      <div className="flex min-w-0 flex-col gap-1">
        <InstanceCow cattleId={instance.cattle_id} />
        <p className="pl-12 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{instance.protocol_name}</span>
          <span aria-hidden className="mx-1.5">·</span>
          {t("startedOn")} <DateText date={instance.start_date} />
        </p>
      </div>
      <div className="min-w-0 rounded-lg bg-muted/40 px-3.5 py-2.5">{progress}</div>
      <div className="flex items-center justify-between gap-2 md:justify-end">
        <Chip variant={STATUS_VARIANT[instance.status]} className="shrink-0">
          {t(`statusValue.${instance.status}`)}
        </Chip>
        <ProtocolInstanceActions instance={instance} onViewTimeline={onTimeline} />
      </div>
    </li>
  );
}

/** Resolves a protocol instance's `cattle_id` to a name/tag via `GET /cattle/:id` (cached — the
 * same cow shows up across multiple instances/renders). Falls back to a shortened id if the lookup
 * 404s/fails rather than blocking the row. */
function InstanceCow({ cattleId }: { cattleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cattle-lookup", cattleId],
    queryFn: () => cattleApi.findOne(cattleId),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-9 w-40" />;
  if (!data) return <span className="font-mono text-sm text-foreground">{cattleId.slice(0, 10)}…</span>;
  return <ReproductionCowIdentity cattleId={cattleId} name={data.name} tag={data.tagNumber} />;
}

"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Pagination } from "@/components/shared/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealthPlansPagedList, useHealthTasks, useRounds } from "../hooks/use-health";
import { HealthPlanCard } from "./health-plan-card";
import { CreateHealthPlanDialog } from "./create-health-plan-dialog";
import { HEALTH_CONDITIONS } from "./report-sickness/condition-chips";
import { ApplyHealthPlanDialog } from "./apply-health-plan-dialog";
import { OPEN_STEP_STATUSES, ProtocolSheet, type ProtocolSheetTarget } from "./protocol-sheet";
import { AppliedView } from "./applied-view";
import { defaultProtocolsView, type AppliedStatus, type ProtocolsView } from "../round-model";
import type { HealthCondition, HealthPlanKind, HealthPlanListItem, ProtocolRound } from "../types";

type KindFilter = "ALL" | HealthPlanKind;
const KIND_FILTERS: KindFilter[] = ["ALL", "TREATMENT", "PREVENTION", "BREEDING"];

/** Most urgent first: protocols with overdue steps, then steps due today, then the soonest next step; ones with nothing
 * scheduled last, by name. Applied to the page on screen (the server pages by creation date). */
export function byUrgency(a: HealthPlanListItem, b: HealthPlanListItem): number {
  if (a.stats.stepsOverdue !== b.stats.stepsOverdue) return b.stats.stepsOverdue - a.stats.stepsOverdue;
  if (a.stats.stepsDue !== b.stats.stepsDue) return b.stats.stepsDue - a.stats.stepsDue;
  if (a.stats.nextDueDate !== b.stats.nextDueDate) {
    if (!a.stats.nextDueDate) return 1;
    if (!b.stats.nextDueDate) return -1;
    return a.stats.nextDueDate < b.stats.nextDueDate ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

/**
 * "Protocols" tab (RFE-107 rename; was "Health Plan") — Figma 734:45281 (list) + "Create New Health Plan" 3-step wizard
 * (734:47059/47993/48743) + "Apply Health Plan Template" 2-step wizard (734:49979/50881).
 *
 * **RFE-142 (MILESTONE 29c, EPIC D12)** — one list of protocols that shows what each is doing now, not a template catalog:
 *  - **no In use | All switch** — a protocol is applied to many cows, so "in use" is not a property of the protocol. One
 *    list, the page on screen sorted most urgent first (overdue, due today, soonest); idle protocols read as idle on
 *    their card. A protocol archived while animals are still on it stays in the list, flagged "Deleted" (the server keeps it);
 *  - kind and condition filters, search — all applied **by the server**, so the pager is honest (the kind chips used to
 *    filter only the page already loaded, and their counts were page counts);
 *  - a numbered pager (10 / 20 / 50 / 100 per page) instead of the first 20 protocols and nothing else.
 *
 * **RFE-143** — a card opens the protocol sheet (`ProtocolSheet`: due steps to record / reschedule / skip, the animals on it,
 * the step sequence, results). That sheet replaces the old "Care steps" (Schedule) tab and the Sick Bay "Preventive
 * Rounds" view. Steps that belong to no protocol (none are created today; this is for legacy rows) get one
 * "Not part of a protocol" entry above the list, shown only when such steps exist, so they cannot vanish with the old tab.
 */
export function HealthPlanTab({
  onManageCase,
  openRoundKey,
  onRoundOpened,
  status: statusProp,
  onStatusChange,
}: {
  onManageCase?: (caseId: string) => void;
  /** RFE-150: a round to open as soon as the Running list has loaded (the needs-attention strip's link). */
  openRoundKey?: string | null;
  /** Called once `openRoundKey` has been handled (opened, or not found), so the caller can clear it from the URL. */
  onRoundOpened?: () => void;
  /** The Applied list's status choice, kept in the URL by the caller (`?status=`) so the Late steps tile can link to it. When the
   * caller does not own it, the tab keeps it itself. Default: Needs action. */
  status?: AppliedStatus | null;
  onStatusChange?: (status: AppliedStatus) => void;
}) {
  const t = useTranslations("health.healthPlan");
  const tCondition = useTranslations("health.reportSickness");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [condition, setCondition] = useState<HealthCondition | "ALL">("ALL");
  // EPIC_PROTOCOL_ROUNDS D1: Running (rounds) | Library (protocols). `null` = not chosen yet, so follow the default:
  // Running when anything is due or late, otherwise Library. The user's own choice wins from then on.
  const [view, setView] = useState<ProtocolsView | null>(null);
  const [statusLocal, setStatusLocal] = useState<AppliedStatus | null>(null);
  const status: AppliedStatus = statusProp ?? statusLocal ?? "needs";
  function setStatus(next: AppliedStatus) {
    setStatusLocal(next);
    onStatusChange?.(next);
  }
  const runningAll = useRounds({ status: "RUNNING" });
  const runningRounds = runningAll.data?.items ?? [];
  // A link to a status (`?status=needs`, the Late steps tile) must land on Applied even when the default would pick Library.
  const activeView: ProtocolsView | null = view ?? (statusProp ? "running" : runningAll.isSuccess ? defaultProtocolsView(runningRounds) : runningAll.isError ? "library" : null);
  const list = useHealthPlansPagedList({
    search: deferredSearch || undefined,
    condition: condition === "ALL" ? undefined : condition,
    kind: kind === "ALL" ? undefined : kind,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<HealthPlanListItem | undefined>(undefined);
  const [applyingPlan, setApplyingPlan] = useState<HealthPlanListItem | undefined>(undefined);
  // The sheet keeps only the id of the open protocol and reads it back from the live list, so its header counts follow
  // every record / skip / reschedule; the snapshot is the fallback once the protocol leaves the page on screen.
  const [openSheet, setOpenSheet] = useState<{ kind: "plan"; id: string; snapshot: HealthPlanListItem } | { kind: "round"; key: string; snapshot: ProtocolRound } | { kind: "loose" } | null>(null);
  const loose = useHealthTasks({ noPlan: true, statuses: OPEN_STEP_STATUSES });
  const looseCount = loose.data?.items.length ?? 0;
  // RFE-150: a link from the needs-attention strip names a round. Open it once the Running list is in; if it is gone (finished
  // since the strip was drawn) just drop the param. Either way the caller clears it, so closing the sheet does not reopen it.
  const rounds = runningAll.data?.items;
  useEffect(() => {
    if (!openRoundKey || !runningAll.isSuccess) return;
    const found = rounds?.find((r) => r.roundKey === openRoundKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a URL param, once; the caller clears it
    if (found) setOpenSheet({ kind: "round", key: found.roundKey, snapshot: found });
    onRoundOpened?.();
  }, [openRoundKey, runningAll.isSuccess, rounds, onRoundOpened]);
  const sheetTarget: ProtocolSheetTarget | null =
    openSheet === null
      ? null
      : openSheet.kind === "loose"
        ? { kind: "loose" }
        : openSheet.kind === "round"
          ? { kind: "round", round: runningRounds.find((r) => r.roundKey === openSheet.key) ?? openSheet.snapshot }
          : { kind: "plan", plan: list.items.find((p) => p.id === openSheet.id) ?? openSheet.snapshot };

  const filtered = kind !== "ALL" || condition !== "ALL" || deferredSearch !== "";
  // The Library is templates only, so no urgency order (that is progress): newest first, as the server pages them.
  const plans = list.items;

  function clearFilters() {
    setKind("ALL");
    setCondition("ALL");
    setSearch("");
  }
  function openCreate() {
    setEditingPlan(undefined);
    setFormOpen(true);
  }

  if (activeView === null || (activeView === "library" && list.isLoading)) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[260px] w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  if (activeView === "library" && list.isError) return <ErrorState description={t("error")} onRetry={() => void list.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} className="pl-9" />
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          {t("createNewPlan")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t("views.label")} className="flex flex-wrap items-center gap-2">
          {(["library", "running"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={activeView === v}
              onClick={() => setView(v)}
              className={cn(
                "flex min-h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                activeView === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {v === "running" ? t("views.runningCount", { count: runningRounds.length }) : t("views.library")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label={t("filters.kindLabel")} className="flex flex-wrap items-center gap-2">
          {KIND_FILTERS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
                kind === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {t(`filters.kind.${k}`)}
            </button>
          ))}
        </div>
        {activeView === "library" ? (
          <Select value={condition} onValueChange={(value) => setCondition(value as HealthCondition | "ALL")}>
            <SelectTrigger className="w-full sm:w-52" aria-label={t("filters.conditionLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("filters.allConditions")}</SelectItem>
              {HEALTH_CONDITIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {tCondition(`conditionValue.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {activeView === "running" ? (
        <>
          {looseCount > 0 && !filtered && status !== "finished" ? (
            <button
              type="button"
              onClick={() => setOpenSheet({ kind: "loose" })}
              className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-left text-sm transition-colors hover:border-foreground/30"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-foreground">{t("loose.entryTitle")}</span>
                <span className="text-xs text-muted-foreground">{t("loose.entryCount", { count: looseCount, more: loose.data?.meta.hasNextPage ? "+" : "" })}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ) : null}

          <AppliedView
            kind={kind}
            search={deferredSearch}
            status={status}
            onStatusChange={setStatus}
            onOpen={(round) => setOpenSheet({ kind: "round", key: round.roundKey, snapshot: round })}
            onShowLibrary={() => setView("library")}
          />
        </>
      ) : (
        <>
          {plans.length === 0 && filtered ? (
            <EmptyState
              title={t("emptyFilteredTitle")}
              description={t("emptyFilteredDescription")}
              action={
                <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
                  {t("filters.clear")}
                </Button>
              }
            />
          ) : plans.length === 0 ? (
            <EmptyState
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              action={
                <Button type="button" size="sm" onClick={openCreate}>
                  {t("createNewPlan")}
                </Button>
              }
            />
          ) : (
            <div className={cn("grid grid-cols-1 gap-4 transition-opacity lg:grid-cols-2", list.isFetching && "opacity-70")}>
              {plans.map((plan) => (
                <HealthPlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={(p) => {
                    setEditingPlan(p);
                    setFormOpen(true);
                  }}
                  onApply={setApplyingPlan}
                />
              ))}
            </div>
          )}

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

        </>
      )}

      <CreateHealthPlanDialog open={formOpen} onOpenChange={setFormOpen} plan={editingPlan} />
      <ProtocolSheet target={sheetTarget} onOpenChange={(open) => !open && setOpenSheet(null)} onApply={setApplyingPlan} onManageCase={onManageCase} />
      <ApplyHealthPlanDialog plan={applyingPlan} onOpenChange={(open) => !open && setApplyingPlan(undefined)} />
    </div>
  );
}

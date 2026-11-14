"use client"; // live queries, client-side paging, the add-animals dialog

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronRight, Undo2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import { Chip } from "@rakhal/ui/ui/chip";
import { Progress } from "@rakhal/ui/ui/progress";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { Pagination } from "@/components/shared/pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/hooks/use-cursor-pager";
import { useCancelRound, useRounds } from "../hooks/use-health";
import { APPLIED_STATUSES, farmDay, roundMatchesStatus, roundProgressPct, roundUrgency, type AppliedStatus } from "../round-model";
import type { HealthPlanKind, ProtocolRound } from "../types";
import { RoundAnimalsDialog } from "./round-animals-dialog";

const KIND_CHIP: Record<ProtocolRound["kind"], { variant: "info" | "indigo" | "muted"; labelKey: "treatment" | "prevention" | "breeding" }> = {
  TREATMENT: { variant: "info", labelKey: "treatment" },
  PREVENTION: { variant: "indigo", labelKey: "prevention" },
  BREEDING: { variant: "muted", labelKey: "breeding" },
};

/**
 * The Protocols page's **Applied** view — the one place that shows what is happening with a protocol: one table row per applied
 * protocol (a round: one application on one farm day) with its animals, progress, late / due steps and the next step, paged
 * (10 / 20 / 50 / 100). The Library only holds the templates (create, apply, edit); steps, animals, results and recording a
 * step all live behind a row's **Details** (`ProtocolSheet`, round target).
 *
 * One status choice — Needs action | Upcoming | Finished | All. Needs action = rounds with a step late or due today. The rounds
 * are loaded once (the 100 most recent per status) and paged on screen, so the page size and page never refetch.
 */
export function AppliedView({
  kind,
  search,
  status,
  onStatusChange,
  onOpen,
  onShowLibrary,
  hideStatusPicker = false,
}: {
  kind: HealthPlanKind | "ALL";
  search: string;
  status: AppliedStatus;
  onStatusChange: (status: AppliedStatus) => void;
  /** Opens the full round sheet (Progress table, Steps, Results). */
  onOpen: (round: ProtocolRound) => void;
  onShowLibrary: () => void;
  hideStatusPicker?: boolean;
}) {
  const t = useTranslations("health.healthPlan.applied");
  const tRounds = useTranslations("health.healthPlan.rounds");
  const filters = { kind: kind === "ALL" ? undefined : kind, search: search || undefined };
  const running = useRounds({ status: "RUNNING", ...filters });
  const finishedQuery = useRounds({ status: "FINISHED", ...filters }, { enabled: status === "finished" });
  const [adding, setAdding] = useState<ProtocolRound | null>(null);
  // Undo a whole application (applied to the wrong group / the wrong protocol): one call reverses every dose and removes the round.
  const [cancelling, setCancelling] = useState<ProtocolRound | null>(null);
  const cancelRound = useCancelRound();
  const tUndo = useTranslations("health.protocolUndo");
  async function confirmCancelRound() {
    if (!cancelling) return;
    try {
      const result = await cancelRound.mutateAsync({ roundKey: cancelling.roundKey });
      toast.success(tUndo("roundCancelledToast", { animals: result.animals, doses: result.dosesReversed }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tUndo("genericError"));
    }
  }
  // Page + size follow the list they were chosen on: a new status / filter starts again at page 1.
  const listKey = `${status}|${kind}|${search}`;
  const [paging, setPaging] = useState({ key: listKey, page: 1, size: DEFAULT_PAGE_SIZE });
  const page = paging.key === listKey ? paging.page : 1;

  const query = status === "finished" ? finishedQuery : running;
  const runningRounds = [...(running.data?.items ?? [])].sort(roundUrgency);
  const counts: Record<AppliedStatus, number | null> = {
    needs: runningRounds.filter((r) => roundMatchesStatus(r, "needs")).length,
    upcoming: runningRounds.filter((r) => roundMatchesStatus(r, "upcoming")).length,
    finished: null,
    all: runningRounds.length,
  };
  const rounds = status === "finished" ? (finishedQuery.data?.items ?? []) : runningRounds.filter((r) => roundMatchesStatus(r, status));
  const totalPages = Math.max(1, Math.ceil(rounds.length / paging.size));
  const safePage = Math.min(page, totalPages);
  const pageRows = rounds.slice((safePage - 1) * paging.size, safePage * paging.size);
  const filtered = kind !== "ALL" || search !== "";

  const picker = (
    <div role="radiogroup" aria-label={t("statusLabel")} className="flex flex-wrap items-center gap-2">
      {APPLIED_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={status === s}
          onClick={() => onStatusChange(s)}
          className={cn(
            "flex min-h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
            status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          )}
        >
          {t(`status.${s}`)}
          {counts[s] !== null && !running.isLoading ? <span className="text-xs opacity-80">{counts[s]}</span> : null}
        </button>
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (query.isLoading) {
    body = (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (query.isError) {
    body = <ErrorState description={tRounds("error")} onRetry={() => void query.refetch()} />;
  } else if (rounds.length === 0) {
    const showAll = (
      <Button type="button" size="sm" variant="outline" onClick={() => onStatusChange("all")}>
        {t("showAll")}
      </Button>
    );
    if (filtered) body = <EmptyState title={tRounds("emptyFilteredTitle")} />;
    else if (status === "needs") body = <EmptyState title={t("emptyNeedsTitle")} description={t("emptyNeedsDescription")} action={showAll} />;
    else if (status === "upcoming") body = <EmptyState title={t("emptyUpcomingTitle")} description={t("emptyUpcomingDescription")} action={showAll} />;
    else if (status === "finished") body = <EmptyState title={tRounds("emptyFinishedTitle")} description={tRounds("emptyFinishedDescription")} />;
    else {
      body = (
        <EmptyState
          title={tRounds("emptyRunningTitle")}
          description={tRounds("emptyRunningDescription")}
          action={
            <Button type="button" size="sm" onClick={onShowLibrary}>
              {tRounds("goLibrary")}
            </Button>
          }
        />
      );
    }
  } else {
    body = (
      <div className={cn("flex flex-col gap-3 transition-opacity", query.isFetching && "opacity-70")}>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.protocol")}</TableHead>
                <TableHead>{t("table.started")}</TableHead>
                <TableHead className="text-right">{t("table.animals")}</TableHead>
                <TableHead className="min-w-40">{t("table.progress")}</TableHead>
                <TableHead>{t("table.attention")}</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">{t("table.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((round) => (
                <AppliedRow key={round.roundKey} round={round} onOpen={onOpen} onAdd={setAdding} onCancel={setCancelling} />
              ))}
            </TableBody>
          </Table>
        </div>
        {query.data?.meta.hasNextPage ? <p className="text-xs text-warning">{tRounds("truncated")}</p> : null}
        {rounds.length > DEFAULT_PAGE_SIZE || paging.size !== DEFAULT_PAGE_SIZE ? (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={(next) => setPaging({ key: listKey, page: next, size: paging.size })}
            pageSize={paging.size}
            onPageSizeChange={(size) => setPaging({ key: listKey, page: 1, size })}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      {!hideStatusPicker && picker}
      {body}
      {adding ? <RoundAnimalsDialog round={adding} open onOpenChange={(next) => !next && setAdding(null)} /> : null}
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={tUndo("roundTitle")}
        description={cancelling ? tUndo("roundBody", { protocol: cancelling.healthPlan.name, count: cancelling.animalCount }) : undefined}
        confirmLabel={tUndo("roundConfirm")}
        cancelLabel={tUndo("back")}
        onConfirm={confirmCancelRound}
      />
    </div>
  );
}

function AppliedRow({
  round,
  onOpen,
  onAdd,
  onCancel,
}: {
  round: ProtocolRound;
  onOpen: (round: ProtocolRound) => void;
  onAdd: (round: ProtocolRound) => void;
  onCancel: (round: ProtocolRound) => void;
}) {
  const t = useTranslations("health.healthPlan.applied");
  const tRounds = useTranslations("health.healthPlan.rounds");
  const tCard = useTranslations("health.healthPlan.card");
  const format = useFormatter();
  const can = useCan();
  const fmt = (ymd: string) => format.dateTime(farmDay(ymd), { day: "numeric", month: "short" });
  const date = fmt(round.startDate);
  const chip = KIND_CHIP[round.kind];
  const archived = Boolean(round.healthPlan.deletedAt);
  const finished = round.status === "FINISHED";
  const pct = roundProgressPct(round);

  return (
    <TableRow className="cursor-pointer" onClick={() => onOpen(round)}>
      <TableCell className="max-w-64 whitespace-normal">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            aria-label={tRounds("openAria", { name: round.healthPlan.name, date })}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(round);
            }}
            className="rounded-sm text-left text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {round.healthPlan.name}
          </button>
          <div className="flex flex-wrap items-center gap-1">
            <Chip variant={chip.variant}>{tCard(`type.${chip.labelKey}`)}</Chip>
            {archived ? <Chip variant="destructive">{tCard("deleted")}</Chip> : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{date}</TableCell>
      <TableCell className="text-right text-sm tabular-nums text-foreground">{round.animalCount}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Progress value={pct} aria-label={tRounds("stepsDone", { done: round.stepsDone, total: round.stepsTotal })} className="h-1.5" />
          <span className="text-xs text-muted-foreground">{tRounds("stepsDone", { done: round.stepsDone, total: round.stepsTotal })}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          {finished ? <Chip variant="muted">{tRounds("finished")}</Chip> : null}
          {!finished && round.stepsOverdue > 0 ? <Chip variant="destructive">{tRounds("overdue", { count: round.stepsOverdue })}</Chip> : null}
          {!finished && round.stepsDueToday > 0 ? <Chip variant="warning">{tRounds("dueToday", { count: round.stepsDueToday })}</Chip> : null}
          {!finished && round.stepsOverdue === 0 && round.stepsDueToday === 0 ? (
            <span className="text-xs text-muted-foreground">{round.nextDueDate ? tRounds("next", { date: fmt(round.nextDueDate) }) : tRounds("nothingDue")}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {can("healthcare.update") && !archived && !finished ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              aria-label={t("addAnimals")}
              title={t("addAnimals")}
              onClick={(e) => {
                e.stopPropagation();
                onAdd(round);
              }}
            >
              <UserPlus className="size-4" aria-hidden />
            </Button>
          ) : null}
          {can("healthcare.update") && !finished ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 text-destructive hover:border-destructive hover:bg-destructive/5"
              aria-label={t("cancelApplication")}
              title={t("cancelApplication")}
              onClick={(e) => {
                e.stopPropagation();
                onCancel(round);
              }}
            >
              <Undo2 className="size-4" aria-hidden />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(round);
            }}
          >
            {t("details")}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

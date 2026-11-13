"use client"; // range state, confirm dialog state, schedule mutations

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock, Loader2, Pause, Pencil, Play, Repeat, Trash2 } from "lucide-react";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useCan } from "@/lib/auth/permissions";
import { addDaysLocalIso, todayLocalIso } from "@/lib/local-date";
import { cn } from "@/lib/utils";
import { useCancelSchedule, usePauseSchedule, useResumeSchedule, useSchedules } from "../hooks/use-schedules";
import { useUpcoming } from "../hooks/use-upcoming";
import type { NotificationSchedule, UpcomingItem } from "../types";

export const UPCOMING_RANGES = { today: 0, week: 6, fortnight: 13 } as const;
export type UpcomingRange = keyof typeof UPCOMING_RANGES;
const RANGE_KEYS = Object.keys(UPCOMING_RANGES) as UpcomingRange[];

export interface UpcomingDayGroup {
  /** Farm-local `YYYY-MM-DD`. */
  day: string;
  items: UpcomingItem[];
}

/** Rows arrive soonest-first; group by the farm-local day the server already computed (`fire_at_local`). */
export function groupByDay(items: UpcomingItem[]): UpcomingDayGroup[] {
  const groups: UpcomingDayGroup[] = [];
  for (const item of items) {
    const day = item.fire_at_local.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

/** NV2-F03 Upcoming tab. `onEdit` is wired by the shell to the composer (F04); no form lives here. */
export function UpcomingTab({ onEdit }: { onEdit?: (id: string) => void }) {
  const t = useTranslations("notificationSheet.upcoming");
  const format = useFormatter();
  const can = useCan();
  const [range, setRange] = useState<UpcomingRange>("fortnight");
  const [cancelTarget, setCancelTarget] = useState<{ id: string; title: string } | null>(null);

  // Window is computed from the browser's calendar day; the server reads it as farm-local dates.
  const today = todayLocalIso();
  const query = useMemo(
    () => ({ from: today, to: addDaysLocalIso(today, UPCOMING_RANGES[range]) }),
    [today, range],
  );
  const list = useUpcoming(query);
  const paused = useSchedules({ scope: "mine", status: "PAUSED" });

  const pause = usePauseSchedule();
  const resume = useResumeSchedule();
  const cancel = useCancelSchedule();

  const canManageOwn = can("notification.create") || can("notification.manage");
  const groups = useMemo(() => groupByDay(list.items), [list.items]);
  const tomorrow = addDaysLocalIso(today, 1);

  function dayLabel(day: string): string {
    const date = new Date(`${day}T00:00:00`);
    const text = format.dateTime(date, { weekday: "short", day: "numeric", month: "short" });
    if (day === today) return `${t("today")} · ${text}`;
    if (day === tomorrow) return `${t("tomorrow")} · ${text}`;
    return text;
  }

  function run(promise: Promise<unknown>, success: string) {
    promise.then(
      () => toast.success(success),
      () => toast.error(t("actionError")),
    );
  }

  const busy = pause.isPending || resume.isPending;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label={t("rangeLabel")}>
        {RANGE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={range === key}
            onClick={() => setRange(key)}
            className={cn(
              "min-h-8 flex-1 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              range === key ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`ranges.${key}`)}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState title={t("errorTitle")} description={t("loadError")} onRetry={() => list.refetch()} className="py-10" />
      ) : groups.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("empty")} description={t("emptyDescription")} className="py-10" />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.day} aria-label={dayLabel(group.day)} className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {dayLabel(group.day)}
              </h3>
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
                {group.items.map((item) => {
                  const own = item.origin === "USER" && item.can_edit && canManageOwn;
                  return (
                    <li key={item.occurrence_id} className="flex items-start gap-3 px-3 py-3">
                      <p className="mt-0.5 w-14 shrink-0 text-sm font-medium tabular-nums text-foreground">
                        {format.dateTime(new Date(item.fire_at_local), { timeStyle: "short" })}
                      </p>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-foreground">{item.title}</p>
                        {item.body ? (
                          <p className="mt-0.5 break-words text-sm text-muted-foreground">{item.body}</p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant={item.origin === "SYSTEM" ? "secondary" : "info"}>
                            {item.origin === "SYSTEM" ? t("source.system") : item.can_edit ? t("source.mine") : t("source.shared")}
                          </Badge>
                          {item.repeat !== "NEVER" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Repeat className="size-3" aria-hidden />
                              {t(`repeat.${item.repeat}`)}
                            </span>
                          ) : null}
                          {item.animals_count > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {t("animals", { count: item.animals_count })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {own ? (
                        <div className="flex shrink-0 gap-0.5">
                          {onEdit ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={t("edit", { title: item.title })}
                              onClick={() => onEdit(item.schedule_id)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9"
                            disabled={busy}
                            aria-label={t("pause", { title: item.title })}
                            onClick={() => run(pause.mutateAsync(item.schedule_id), t("paused"))}
                          >
                            <Pause className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 text-destructive"
                            aria-label={t("cancel", { title: item.title })}
                            onClick={() => setCancelTarget({ id: item.schedule_id, title: item.title })}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {list.hasNextPage ? (
        <div className="flex flex-col items-center gap-1">
          {list.isNextPageError ? <p className="text-xs text-destructive">{t("loadError")}</p> : null}
          <Button variant="outline" size="sm" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
            {list.isFetchingNextPage ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {list.isNextPageError ? t("retry") : t("loadMore")}
          </Button>
        </div>
      ) : null}

      {paused.items.length > 0 ? (
        <PausedList
          items={paused.items}
          disabled={busy}
          canManage={canManageOwn}
          title={t("pausedTitle")}
          resumeLabel={(title) => t("resume", { title })}
          onResume={(id) => run(resume.mutateAsync(id), t("resumed"))}
          onEdit={onEdit}
          editLabel={(title) => t("edit", { title })}
        />
      ) : null}

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title={t("cancelConfirmTitle")}
        description={t("cancelConfirmBody", { title: cancelTarget?.title ?? "" })}
        confirmLabel={t("cancelConfirm")}
        cancelLabel={t("keep")}
        onConfirm={async () => {
          if (!cancelTarget) return;
          try {
            await cancel.mutateAsync(cancelTarget.id);
            toast.success(t("cancelled"));
          } catch {
            toast.error(t("actionError"));
          }
        }}
      />
    </div>
  );
}

/** Paused schedules have no pending occurrences, so they never appear in the feed above; this is the only
 * place a user can resume them. */
function PausedList({
  items,
  disabled,
  canManage,
  title,
  resumeLabel,
  editLabel,
  onResume,
  onEdit,
}: {
  items: NotificationSchedule[];
  disabled: boolean;
  canManage: boolean;
  title: string;
  resumeLabel: (title: string) => string;
  editLabel: (title: string) => string;
  onResume: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
            <p className="min-w-0 flex-1 break-words text-sm text-foreground">{s.title}</p>
            {canManage && s.can_edit ? (
              <div className="flex shrink-0 gap-0.5">
                {onEdit ? (
                  <Button variant="ghost" size="icon" className="size-9" aria-label={editLabel(s.title)} onClick={() => onEdit(s.id)}>
                    <Pencil className="size-4" />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  disabled={disabled}
                  aria-label={resumeLabel(s.title)}
                  onClick={() => onResume(s.id)}
                >
                  <Play className="size-4" />
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

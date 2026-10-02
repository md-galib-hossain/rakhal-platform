"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useHealthTasks } from "../hooks/use-health";
import { countTaskBuckets, dayKeyOf, groupCompletedCount, groupScheduledTasks, taskBucket, type ScheduledTaskGroup } from "../task-grouping";
import { TaskCalendarStrip } from "./task-calendar-strip";
import { ScheduledTaskCard } from "./scheduled-task-card";
import { TaskRescheduleDialog } from "./task-reschedule-dialog";
import { RecordBatchDialog } from "./record-batch-dialog";

type TabKey = "all" | "overdue" | "today" | "upcoming";

/**
 * "Task Hub" segment of the Health Management Center — Figma 734:40931 (main layout) +
 * 734:43007/44187/45177 (Record Vaccination / Task Reschedule / Task List states),
 * `get_design_context`. Calendar strip + filter tabs (All/Overdue/Today's Schedule/Upcoming) over a
 * grid of "Scheduled Task Cards" — real `HealthTask` rows grouped client-side into per-plan cards
 * (see `task-grouping.ts` for why: the backend has no multi-animal batch-task record). **Scope
 * simplification, flagged not silently dropped**: the mock's separate "Task List" drill-in dialog
 * (734:45177, a per-day agenda table) isn't built as its own modal — clicking a calendar day instead
 * filters this same card grid to that date, reaching the same information through one surface
 * instead of two overlapping ones.
 */
export function TaskHubTab() {
  const t = useTranslations("health.taskHub");
  const query = useHealthTasks();

  const now = new Date();
  // `null` = the user hasn't picked a month yet, so the calendar strip should show the computed
  // default below (earliest month with pending work) rather than always today's calendar month.
  // Once they navigate the strip themselves, that choice sticks for the rest of the session.
  const [calendarOverride, setCalendarOverride] = useState<{ year: number; month: number } | null>(null);
  // RFE-137 — the day and the bucket live in the URL so a reminder notification can deep-link straight to them
  // (`/healthcare?healthTab=schedule&date=2026-10-04`, overdue: `&bucket=overdue`). A malformed `date` is ignored.
  const [dateParam, setDateParam] = useQueryState("date", parseAsString);
  const [bucketParam, setBucketParam] = useQueryState("bucket", parseAsStringEnum<Exclude<TabKey, "all">>(["overdue", "today", "upcoming"]));
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  const setSelectedDate = (date: string | null) => void setDateParam(date);
  const activeTab: TabKey = bucketParam ?? "all";
  const setActiveTab = (tab: TabKey) => void setBucketParam(tab === "all" ? null : tab);
  const [reschedulingGroup, setReschedulingGroup] = useState<ScheduledTaskGroup | undefined>(undefined);
  const [recordingGroup, setRecordingGroup] = useState<ScheduledTaskGroup | undefined>(undefined);

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[120px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[337px] w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  if (query.isError) return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;

  const allTasks = query.data?.items ?? [];
  if (allTasks.length === 0) return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;

  const groups = groupScheduledTasks(allTasks);
  const bucketCounts: Record<TabKey, number> = { all: groups.length, ...countTaskBuckets(groups) };

  const pendingGroups = groups.filter((g) => groupCompletedCount(g) < g.tasks.length);
  const earliestPending = pendingGroups.length
    ? pendingGroups.reduce((min, g) => (g.dueDateTime < min.dueDateTime ? g : min))
    : null;
  const defaultCalendarDate = earliestPending ? new Date(earliestPending.dueDateTime) : now;
  // A deep-linked day wins over the "earliest pending work" default, so the strip opens on the month being asked about.
  const calendarYear = calendarOverride?.year ?? (selectedDate ? Number(selectedDate.slice(0, 4)) : defaultCalendarDate.getFullYear());
  const calendarMonth = calendarOverride?.month ?? (selectedDate ? Number(selectedDate.slice(5, 7)) : defaultCalendarDate.getMonth() + 1);

  const visible = groups.filter((group) => {
    if (selectedDate) return dayKeyOf(group.dueDateTime) === selectedDate;
    if (activeTab === "all") return true;
    return taskBucket(group) === activeTab;
  });

  const TABS: { key: TabKey; label: string }[] = [
    { key: "all", label: t("tabs.all") },
    { key: "overdue", label: t("tabs.overdue") },
    { key: "today", label: t("tabs.today") },
    { key: "upcoming", label: t("tabs.upcoming") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <TaskCalendarStrip
        year={calendarYear}
        month={calendarMonth}
        onMonthChange={(y, m) => setCalendarOverride({ year: y, month: m })}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        groups={groups}
      />

      <div className="flex gap-4">
        <div className="flex w-60 shrink-0 flex-col gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedDate(null);
              }}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg p-3 text-left text-sm transition-colors",
                !selectedDate && activeTab === tab.key ? "bg-primary font-bold text-primary-foreground" : "bg-card font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "flex h-[18px] min-w-[22px] items-center justify-center rounded-full px-1 text-[10px]",
                  !selectedDate && activeTab === tab.key
                    ? "bg-card text-primary"
                    : tab.key === "overdue"
                      ? "bg-destructive-tint text-destructive"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {bucketCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1">
          {visible.length === 0 && selectedDate ? (
            // e.g. a reminder link for a step that has since been rescheduled or done
            <EmptyState
              title={t("noTasksOnDate", { date: selectedDate })}
              description={t("noTasksOnDateDescription")}
              action={
                <Button type="button" variant="outline" onClick={() => setSelectedDate(null)}>
                  {t("showAllTasks")}
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {visible.map((group) => (
                <ScheduledTaskCard key={group.key} group={group} onReschedule={setReschedulingGroup} onRecord={setRecordingGroup} />
              ))}
            </div>
          )}
        </div>
      </div>

      <TaskRescheduleDialog group={reschedulingGroup} onOpenChange={(open) => !open && setReschedulingGroup(undefined)} />
      <RecordBatchDialog group={recordingGroup} onOpenChange={(open) => !open && setRecordingGroup(undefined)} />
    </div>
  );
}

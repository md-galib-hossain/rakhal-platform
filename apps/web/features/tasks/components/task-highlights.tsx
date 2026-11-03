"use client"; // due-today shortcut is a click handler

import { CalendarClock, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { TaskHighlights as TaskHighlightsData } from "../types";

/**
 * Slim summary line (was a 4-tile "Task Highlights" card that repeated the Overdue/Blocked counts the
 * filter tabs already show). Now only the two numbers that are NOT a tab: "due today" (a shortcut that
 * sets the date filter to Today) and the late-completion rate (plain number; no fabricated trend).
 */
export function TaskHighlights({
  data,
  isLoading,
  dueTodayActive,
  onDueToday,
}: {
  /** Undefined = nothing trustworthy yet (loading / failed): chips show a dash, never a fake 0. */
  data?: TaskHighlightsData;
  isLoading?: boolean;
  dueTodayActive?: boolean;
  onDueToday?: () => void;
}) {
  const t = useTranslations("tasks.highlights");
  const RateIcon = !data || data.lateCompletionRatePct <= 0 ? TrendingDown : TrendingUp;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", isLoading && "animate-pulse")}>
      <button
        type="button"
        onClick={onDueToday}
        aria-pressed={dueTodayActive}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          dueTodayActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-accent",
        )}
      >
        <CalendarClock className="size-4" aria-hidden />
        {t("dueToday")}
        <span className="font-bold">{data ? data.dueToday : "–"}</span>
      </button>
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground">
        <RateIcon className="size-4" aria-hidden />
        {t("lateRate")}
        <span className="font-bold text-foreground">{data ? `${data.lateCompletionRatePct}%` : "–"}</span>
      </span>
    </div>
  );
}

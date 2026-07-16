import { AlertTriangle, CalendarClock, ListX, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import type { TaskHighlights as TaskHighlightsData } from "../types";

/**
 * "Task Highlights" KPI row (Figma 1039:48345/48350) — 4 real tiles from `GET /tasks`'
 * `meta.highlights` (`TaskService#highlights`). The mock's generic tinted "package" icon is swapped
 * for a semantically-matched `lucide-react` icon per tile (same precedent as the Activity Log's
 * module icons), and the 4th tile's "4.5% vs last month" trend chip is **dropped, not fabricated** —
 * `lateCompletionRatePct` is a plain current-period number server-side with no historical comparison
 * to diff against, matching the app's established "real gap flagged, not faked" convention
 * (`health-key-metrics-card.tsx`'s medicine-expense trend gap).
 */
export function TaskHighlights({ data, isLoading }: { data: TaskHighlightsData; isLoading?: boolean }) {
  const t = useTranslations("tasks.highlights");

  const tiles = [
    {
      key: "dueToday",
      label: t("dueToday"),
      value: data.dueToday,
      description: t("dueTodayDesc", { count: data.dueToday }),
      icon: <CalendarClock className="size-4" aria-hidden />,
      iconClassName: "bg-accent-indigo-tint text-accent-indigo",
    },
    {
      key: "overdue",
      label: t("overdue"),
      value: data.overdue,
      description: t("overdueDesc", { count: data.overdue }),
      icon: <AlertTriangle className="size-4" aria-hidden />,
      iconClassName: "bg-accent-indigo-tint text-accent-indigo",
    },
    {
      key: "blocked",
      label: t("blocked"),
      value: data.blocked,
      description: t("blockedDesc", { count: data.blocked }),
      icon: <ListX className="size-4" aria-hidden />,
      iconClassName: "bg-accent-indigo-tint text-accent-indigo",
    },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
      <p className="text-xl font-medium text-foreground">{t("title")}</p>
      <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4", isLoading && "animate-pulse")}>
        {tiles.map((tile) => (
          <StatCard
            key={tile.key}
            label={tile.label}
            value={tile.value}
            icon={tile.icon}
            iconClassName={tile.iconClassName}
            className="shadow-none"
          />
        ))}
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-info-tint text-info shadow-sm">
              {data.lateCompletionRatePct <= 0 ? <TrendingDown className="size-4" aria-hidden /> : <TrendingUp className="size-4" aria-hidden />}
            </span>
            <p className="text-sm font-medium text-foreground">{t("lateRate")}</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{data.lateCompletionRatePct}%</p>
        </div>
      </div>
    </div>
  );
}

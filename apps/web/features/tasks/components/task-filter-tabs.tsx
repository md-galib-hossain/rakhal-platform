import { AlertTriangle, ListChecks, ListX, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { TaskHighlights, TaskListFilter } from "../types";

const TABS: { value: TaskListFilter; icon: typeof User }[] = [
  { value: "my_tasks", icon: User },
  { value: "all", icon: ListChecks },
  { value: "overdue", icon: AlertTriangle },
  { value: "blocked", icon: ListX },
];

/**
 * "My Tasks / All Tasks / Overdue / Blocked" (Figma "Tabular Option" segmented control, 1039:48401).
 * Icons are swapped for semantically-matched `lucide-react` glyphs in place of the mock's one
 * generic "package" placeholder reused across every tab (same precedent as Activity's module icons).
 * Badge counts are shown only for Overdue/Blocked (real values from `highlights.overdue`/`.blocked`)
 * — the backend's `meta.highlights` has no aggregate "my tasks"/"all tasks" count to back the mock's
 * badges on those two tabs, so those are left unbadged rather than showing a fabricated number.
 */
export function TaskFilterTabs({
  value,
  onChange,
  highlights,
}: {
  value: TaskListFilter;
  onChange: (value: TaskListFilter) => void;
  highlights: TaskHighlights;
}) {
  const t = useTranslations("tasks.filters");
  const badgeFor: Partial<Record<TaskListFilter, number>> = { overdue: highlights.overdue, blocked: highlights.blocked };

  return (
    <div className="flex max-w-full flex-col items-start overflow-x-auto rounded-lg border border-border bg-muted p-1.5">
      <div className="flex items-center gap-1">
        {TABS.map(({ value: tab, icon: Icon }) => {
          const active = tab === value;
          const badge = badgeFor[tab];
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded px-4 py-1.5 text-sm font-bold whitespace-nowrap transition-colors",
                active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {t(tab)}
              {typeof badge === "number" && badge > 0 ? (
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                    active ? "bg-primary-hover text-white" : "bg-border text-muted-foreground",
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

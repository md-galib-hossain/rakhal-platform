"use client";
import { AlertTriangle, ListChecks, ListX, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <Tabs value={value} onValueChange={(v) => onChange(v as TaskListFilter)}>
      <TabsList className="h-11 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ value: tab, icon: Icon }) => {
          const badge = badgeFor[tab];
          return (
            <TabsTrigger key={tab} value={tab} className="shrink-0">
              <Icon className="mr-1.5 size-4" aria-hidden />
              {t(tab)}
              {typeof badge === "number" && badge > 0 ? (
                <span className="ml-1.5 min-w-4.5 rounded-full bg-primary/15 px-1 text-center text-[0.7rem] font-bold leading-4 text-primary">
                  {badge}
                </span>
              ) : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

"use client";
import { AlertTriangle, ListChecks, ListX, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@rakhal/ui/ui/tabs";
import type { TaskHighlights, TaskListFilter } from "../types";
import { BADGE_TONE } from "./task-chip";

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
  panelId,
}: {
  value: TaskListFilter;
  onChange: (value: TaskListFilter) => void;
  /** Absent while loading / failed and nothing is known yet: no badges rather than fake zeros. */
  highlights?: TaskHighlights;
  /** `id` of the `role="tabpanel"` these tabs control (the list area); trigger ids are `${panelId}-tab-<tab>`. */
  panelId: string;
}) {
  const t = useTranslations("tasks.filters");
  const badgeFor: Partial<Record<TaskListFilter, number>> = highlights ? { overdue: highlights.overdue, blocked: highlights.blocked } : {};

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as TaskListFilter)} className="w-full">
      <TabsList aria-label={t("label")} className="w-full justify-start overflow-x-auto sm:w-fit [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ value: tab, icon: Icon }) => {
          const badge = badgeFor[tab];
          return (
            <TabsTrigger key={tab} value={tab} id={`${panelId}-tab-${tab}`} aria-controls={panelId} className="shrink-0">
              <Icon className="mr-1.5 size-4" aria-hidden />
              {t(tab)}
              {typeof badge === "number" && badge > 0 ? (
                <span
                  className={cn(
                    "ml-1.5 min-w-4.5 rounded-full px-1 text-center text-[0.7rem] font-bold leading-4",
                    tab === "overdue" ? BADGE_TONE.destructive : BADGE_TONE.warning,
                  )}
                >
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

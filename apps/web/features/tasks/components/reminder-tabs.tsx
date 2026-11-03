"use client";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { REMINDER_TABS, type ReminderTab } from "../reminder-view";
import { BADGE_TONE } from "./task-chip";

/** Counts come from `meta.reminderHighlights`; Done has none. Replaces the old duplicate counter-pills row. */
export function ReminderTabs({
  value,
  onChange,
  counts,
  panelId,
}: {
  value: ReminderTab;
  onChange: (value: ReminderTab) => void;
  /** Absent while loading / failed and nothing is known yet: no badges rather than fake zeros. */
  counts?: Partial<Record<ReminderTab, number>>;
  /** `id` of the `role="tabpanel"` these tabs control (the list area); trigger ids are `${panelId}-tab-<tab>`. */
  panelId: string;
}) {
  const t = useTranslations("tasks.reminders.tabs");
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ReminderTab)} className="w-full">
      <TabsList aria-label={t("label")} className="w-full justify-start overflow-x-auto sm:w-fit [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {REMINDER_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} id={`${panelId}-tab-${tab}`} aria-controls={panelId} className="shrink-0">
            {t(tab)}
            {counts && counts[tab] ? (
              <span
                className={cn(
                  "ml-1.5 min-w-4.5 rounded-full px-1 text-center text-[0.7rem] font-bold leading-4",
                  tab === "overdue" ? BADGE_TONE.destructive : BADGE_TONE.primary,
                )}
              >
                {counts[tab]}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

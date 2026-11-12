"use client"; // popover state + locale-aware label

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addDays, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { DateRangePicker, type DateRangeOption } from "@/components/shared/date-range-picker";
import type { TaskDateFilter, TaskDatePresetId } from "../types";

const PRESET_IDS: TaskDatePresetId[] = ["all", "today", "tomorrow", "week", "next7", "month"];

/** Inclusive local-day range for a shortcut; `null` = no date constraint. Weeks start Monday, like `presetToRange`. */
export function taskPresetRange(id: TaskDatePresetId, now = new Date()) {
  const today = startOfDay(now);
  switch (id) {
    case "all":
      return null;
    case "today":
      return { from: today, to: today };
    case "tomorrow":
      return { from: addDays(today, 1), to: addDays(today, 1) };
    case "week":
      return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) };
    case "next7":
      return { from: today, to: addDays(today, 6) };
    case "month":
      return { from: startOfMonth(today), to: endOfMonth(today) };
  }
}

/**
 * Task Hub date filter (user request, no ticket) — the shared `DateRangePicker` in its `options`
 * mode: shortcut column (All dates / Today / Tomorrow / This week / Next 7 days / This month) beside
 * a calendar where the user can pick a range, or a single day. Presentation-only; `tasks-view.tsx`
 * turns the value into `dueFrom`/`dueTo`. Presets store only their id so "today" stays right across midnight.
 */
export function TaskDateFilterPicker({
  value,
  onChange,
}: {
  value: TaskDateFilter;
  onChange: (value: TaskDateFilter) => void;
}) {
  const t = useTranslations("tasks.dateFilters");
  const locale = useLocale();

  const options = useMemo<DateRangeOption[]>(() => {
    const now = new Date();
    return PRESET_IDS.map((id) => ({ id, label: t(id), range: taskPresetRange(id, now) }));
  }, [t]);

  const label = useMemo(() => {
    if (value.id !== "custom") return t(value.id);
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
    const from = fmt.format(value.from);
    return value.from.toDateString() === value.to.toDateString() ? from : `${from} – ${fmt.format(value.to)}`;
  }, [value, locale, t]);

  const today = startOfDay(new Date());
  const range =
    value.id === "custom" ? { from: value.from, to: value.to } : (taskPresetRange(value.id) ?? { from: today, to: today });

  return (
    <DateRangePicker
      className="w-full sm:w-auto sm:min-w-[220px]"
      range={range}
      label={label}
      options={options}
      activeOptionId={value.id}
      applyLabel={t("apply")}
      onOptionSelect={(o) => onChange({ id: o.id as TaskDatePresetId })}
      onRangeChange={(from, to) => onChange({ id: "custom", from, to })}
    />
  );
}

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { TaskDatePreset } from "../types";

const PRESETS: TaskDatePreset[] = ["all", "today", "week", "month"];

/**
 * Date filter tabs (user request, no ticket #, no Figma frame — smallest real affordance styled to
 * match the existing `TaskFilterTabs` segmented control rather than inventing new IA). Presets map
 * to a `dueAt` range computed by the caller (`tasks-view.tsx`) and sent as `dueFrom`/`dueTo` to the
 * real backend filter (`ListTaskQueryDto.dueFrom`/`.dueTo`) — this component is presentation-only.
 */
export function TaskDateTabs({
  value,
  onChange,
}: {
  value: TaskDatePreset;
  onChange: (value: TaskDatePreset) => void;
}) {
  const t = useTranslations("tasks.dateFilters");

  return (
    <div className="flex max-w-full items-start overflow-x-auto rounded-lg border border-border bg-muted p-1.5">
      <div className="flex items-center gap-1">
        {PRESETS.map((preset) => {
          const active = preset === value;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-bold whitespace-nowrap transition-colors",
                active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(preset)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

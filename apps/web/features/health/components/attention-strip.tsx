"use client"; // reads the URL-synced tab state and sets it when a tile is tapped

import { useTranslations } from "next-intl";
import { parseAsString, useQueryStates } from "nuqs";
import { AlarmClock, CalendarCheck, CheckCircle2, Milk } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthTasks, useSafetyWithdrawals } from "../hooks/use-health";
import { countWithdrawalsEndingSoon } from "../sick-bay-model";
import { countTaskBuckets, groupScheduledTasks } from "../task-grouping";

/** Element id of the withdrawals section in the Treatments tab — the strip scrolls to it. */
export const WITHDRAWALS_SECTION_ID = "health-withdrawals";

type Tone = "destructive" | "primary" | "warning";

const TONE: Record<Tone, string> = {
  destructive: "border-destructive/40 bg-destructive-tint text-destructive",
  primary: "border-primary/40 bg-primary/10 text-primary",
  warning: "border-warning/40 bg-warning-tint text-warning",
};

function Tile({ icon, count, label, tone, onClick }: { icon: React.ReactNode; count: number; label: string; tone: Tone; onClick: () => void }) {
  const active = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left transition-colors",
        active ? TONE[tone] : "border-border text-muted-foreground hover:border-foreground/30",
      )}
    >
      <span className="shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="text-2xl font-bold leading-none tabular-nums">{count}</span>
      <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </button>
  );
}

/** RFE-134 / EPIC_HEALTH_CENTER D11 — what needs a person today, above the tabs: steps overdue, steps due today, animals
 * whose withdrawal ends within 3 days. Each tile is a link into the filtered view; the first two use the Schedule
 * tab's own bucketing so the number here is the number on the pill it opens. Shows nothing until the numbers are
 * in (the strip is a shortcut, never worth a skeleton or an error), and a calm one-liner when all three are zero. */
export function AttentionStrip() {
  const t = useTranslations("health.managementCenter.attention");
  const tasks = useHealthTasks();
  const withdrawals = useSafetyWithdrawals({ activeOnly: true, limit: 100 });
  const [, setParams] = useQueryStates({ healthTab: parseAsString, bucket: parseAsString, date: parseAsString });

  if (!tasks.data || !withdrawals.data) return null;

  const buckets = countTaskBuckets(groupScheduledTasks(tasks.data.items));
  const ending = countWithdrawalsEndingSoon(withdrawals.data.items, 3);

  if (buckets.overdue === 0 && buckets.today === 0 && ending === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
        {t("allClear")}
      </p>
    );
  }

  const openSchedule = (bucket: "overdue" | "today") => void setParams({ healthTab: "schedule", bucket, date: null });
  const openWithdrawals = () => {
    void setParams({ healthTab: "treatments", bucket: null, date: null });
    // The section is in the Treatments tab; give it a beat to mount when coming from another tab.
    window.setTimeout(() => document.getElementById(WITHDRAWALS_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  };

  return (
    <div role="group" aria-label={t("label")} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Tile icon={<AlarmClock className="size-5" />} count={buckets.overdue} label={t("overdue")} tone="destructive" onClick={() => openSchedule("overdue")} />
      <Tile icon={<CalendarCheck className="size-5" />} count={buckets.today} label={t("today")} tone="primary" onClick={() => openSchedule("today")} />
      <Tile icon={<Milk className="size-5" />} count={ending} label={t("withdrawals")} tone="warning" onClick={openWithdrawals} />
    </div>
  );
}

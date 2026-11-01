"use client"; // reads the overview + reproduction-summary queries the state cards already share

import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { addDaysLocalIso, todayLocalIso } from "@/lib/local-date";
import { useCattleOverview, useCattleReproductionSummary } from "../../hooks/use-cattle-detail-tabs";
import type { CattleDetail } from "../../types";

const DASH = "—";

/** Whole days between an ISO date (or instant) and today, in the viewer's local calendar. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso);
  const a = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * Header stats row (RFE-171, 05 §3.2): DIM, days pregnant (or open), last milk, last weight. A missing value shows `—`
 * and never hides the stat, so the row does not jump while the queries load. Below `sm` only the first two show; the
 * rest are on the state cards (05 §3.3).
 */
export function WorkspaceStats({ cattle }: { cattle: CattleDetail }) {
  const t = useTranslations("events.workspace.stats");
  const tw = useTranslations("events.workspace");
  const female = cattle.gender === "FEMALE";
  const overview = useCattleOverview(cattle.id).data;
  const repro = useCattleReproductionSummary(cattle.id, female).data;

  const pregnant = cattle.reproductiveStatus === "PREGNANT";
  const reproValue = pregnant ? repro?.daysPregnant : repro?.daysOpen;
  const lastMilk = overview?.recent_milk_records.at(-1);
  const lastWeight = overview?.weight_history.at(-1);
  const ago = (iso: string | undefined) => {
    if (!iso) return null;
    const days = daysSince(iso);
    return days === 0 ? t("today") : days === 1 ? t("yesterday") : t("daysAgo", { days });
  };

  const weightKg = overview?.last_weight_kg ?? lastWeight?.weight_kg;
  const bcs = overview?.bcs_records?.at(-1)?.score ?? null;
  const missing = tw("notRecorded");
  const format = useFormatter();
  const dayLabel = (iso: string) => format.dateTime(new Date(`${iso.slice(0, 10)}T00:00:00`), { day: "numeric", month: "short" });

  // "Days open" is a real number for an open or bred cow: calving to today (the repro summary's own value, else DIM).
  const openDays = repro?.daysOpen ?? (cattle.dim != null && !pregnant ? cattle.dim : null);
  const calved = cattle.dim != null ? dayLabel(addDaysLocalIso(todayLocalIso(), -cattle.dim)) : null;
  type Cell = { key: string; label: string; value: string | null; hint?: string | null };
  const cells: Cell[] = [];
  const milkCell: Cell = { key: "milk", label: t("lastMilk"), value: lastMilk ? t("litres", { value: Math.round(lastMilk.total_l * 10) / 10 }) : null, hint: ago(lastMilk?.date) };
  const weightCell: Cell = { key: "weight", label: t("lastWeight"), value: weightKg != null ? t("kg", { value: weightKg }) : null, hint: ago(lastWeight?.date) };
  if (female && cattle.dim != null) {
    cells.push({ key: "dim", label: t("dim"), value: String(cattle.dim), hint: calved ? t("since", { date: calved }) : null });
    cells.push(
      pregnant
        ? { key: "repro", label: t("daysPregnant"), value: reproValue != null ? String(reproValue) : null, hint: repro?.expectedCalvingDate ? t("due", { date: dayLabel(repro.expectedCalvingDate) }) : null }
        : { key: "repro", label: t("daysOpen"), value: openDays != null ? String(openDays) : null, hint: openDays != null ? t("sinceCalving") : null },
    );
    cells.push(milkCell, weightCell);
  } else {
    // Heifers, calves, bulls and steers have no lactation: age, then what applies to them.
    const years = cattle.dateOfBirth ? Math.floor(daysSince(cattle.dateOfBirth) / 365.25) : null;
    const months = cattle.dateOfBirth ? Math.floor((daysSince(cattle.dateOfBirth) % 365.25) / 30.44) : null;
    cells.push({ key: "age", label: t("age"), value: years != null && months != null ? tw("ageValue", { years, months }) : null });
    cells.push(
      female && pregnant
        ? { key: "repro", label: t("daysPregnant"), value: reproValue != null ? String(reproValue) : null }
        : { key: "bcs", label: t("bcs"), value: bcs != null ? String(bcs) : null, hint: overview?.bcs_records?.at(-1)?.date ? ago(overview.bcs_records.at(-1)?.date) : null },
    );
    cells.push(weightCell);
    cells.push(female ? { key: "dim", label: t("status"), value: cattle.reproductiveStatus ? (t.has(`repro.${cattle.reproductiveStatus}` as never) ? t(`repro.${cattle.reproductiveStatus}` as never) : null) : null } : { key: "breed", label: t("breed"), value: cattle.breed?.name ?? null });
  }

  return (
    <dl
      aria-label={t("label")}
      className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-4 [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-border sm:[&>*:nth-child(n+3)]:border-t-0"
    >
      {cells.map((c) => (
        <div key={c.key} className="flex min-w-0 flex-col gap-1 px-4 py-3 sm:px-6 sm:py-4">
          <dt className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{c.label}</dt>
          <dd className={cn("truncate text-xl font-bold tabular-nums sm:text-2xl", c.value == null ? "text-muted-foreground" : "text-foreground")}>{c.value ?? DASH}</dd>
          <dd className="truncate text-xs text-muted-foreground">{c.value == null ? missing : (c.hint ?? " ")}</dd>
        </div>
      ))}
    </dl>
  );
}

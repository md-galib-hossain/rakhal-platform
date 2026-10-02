"use client"; // formatter + open callback

import { useFormatter, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { roundProgressPct } from "../round-model";
import type { ProtocolRound } from "../types";

const KIND_CHIP: Record<ProtocolRound["kind"], { variant: "info" | "indigo" | "muted"; labelKey: "treatment" | "prevention" | "breeding" }> = {
  TREATMENT: { variant: "info", labelKey: "treatment" },
  PREVENTION: { variant: "indigo", labelKey: "prevention" },
  BREEDING: { variant: "muted", labelKey: "breeding" },
};

/** `YYYY-MM-DD` (a farm calendar day) as a local `Date` at noon, so formatting it never slips a day across zones. */
export function farmDay(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * One round on the Protocols page's **Running** view (RFE-146, EPIC_PROTOCOL_ROUNDS §5.1): which protocol, when it was
 * applied, how many animals, how far along, and — before anything else — whether it needs anyone today (red = steps late,
 * amber = due today, otherwise the next step's day). The whole card opens the round sheet.
 */
export function RoundCard({ round, onOpen }: { round: ProtocolRound; onOpen: (round: ProtocolRound) => void }) {
  const t = useTranslations("health.healthPlan.rounds");
  const tCard = useTranslations("health.healthPlan.card");
  const format = useFormatter();
  const day = (ymd: string) => format.dateTime(farmDay(ymd), { day: "numeric", month: "short" });
  const kind = KIND_CHIP[round.kind];
  const finished = round.status === "FINISHED";
  const archived = Boolean(round.healthPlan.deletedAt);
  const pct = roundProgressPct(round);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => onOpen(round)}
          aria-label={t("openAria", { name: round.healthPlan.name, date: day(round.startDate) })}
          className="min-w-0 flex-1 basis-40 rounded-sm text-left text-lg font-bold leading-snug text-foreground [overflow-wrap:anywhere] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {round.healthPlan.name}
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {finished ? <Chip variant="muted">{t("finished")}</Chip> : null}
          {archived ? <Chip variant="destructive">{tCard("deleted")}</Chip> : null}
          <Chip variant={kind.variant}>{tCard(`type.${kind.labelKey}`)}</Chip>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <span>{t("started", { date: day(round.startDate) })}</span>
        <span className="size-1 rounded-full bg-muted-foreground" aria-hidden />
        <span>{t("animals", { count: round.animalCount })}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-2 w-full rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("stepsDone", { done: round.stepsDone, total: round.stepsTotal })}>
          <div className="h-2 rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{t("stepsDone", { done: round.stepsDone, total: round.stepsTotal })}</span>
      </div>

      {!finished ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {round.stepsOverdue > 0 ? <Chip variant="destructive">{t("overdue", { count: round.stepsOverdue })}</Chip> : null}
          {round.stepsDueToday > 0 ? <Chip variant="warning">{t("dueToday", { count: round.stepsDueToday })}</Chip> : null}
          {round.stepsOverdue === 0 && round.stepsDueToday === 0 ? (
            <span className="text-xs text-muted-foreground">{round.nextDueDate ? t("next", { date: day(round.nextDueDate) }) : t("nothingDue")}</span>
          ) : null}
        </div>
      ) : null}

      <Button type="button" variant="outline" className="h-10 gap-1 self-start text-sm" onClick={() => onOpen(round)}>
        {t("open")}
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

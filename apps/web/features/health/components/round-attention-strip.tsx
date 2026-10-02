"use client"; // live query + formatter

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useRounds } from "../hooks/use-health";
import { roundUrgency } from "../round-model";
import { farmDay } from "./round-card";

const MAX_SHOWN = 3;

/**
 * RFE-150 (EPIC_PROTOCOL_ROUNDS §5.4) — "Needs attention" on the Healthcare page: the running rounds that have steps **late**
 * (not merely due today — today's work is on the Protocols page, this is what slipped), worst first, each linking to
 * `/healthcare?healthTab=protocols&round=<key>`, which opens that round's sheet. It reads the same Running list the
 * Protocols tab does (one cached request) and draws nothing while loading, on error, or when nothing is late — a farm with
 * no problems sees no extra row. Up to three rounds, then "+N more rounds".
 */
export function RoundAttentionStrip() {
  const t = useTranslations("health.healthPlan.sheet.attention");
  const format = useFormatter();
  const query = useRounds({ status: "RUNNING" });
  const late = [...(query.data?.items ?? [])].filter((round) => round.stepsOverdue > 0).sort(roundUrgency);
  if (late.length === 0) return null;

  const shown = late.slice(0, MAX_SHOWN);
  const hidden = late.length - shown.length;
  const day = (ymd: string) => format.dateTime(farmDay(ymd), { day: "numeric", month: "short" });

  return (
    <section aria-label={t("title")} className="flex flex-col gap-2 rounded-2xl border border-destructive/40 bg-destructive-tint p-3 sm:p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {shown.map((round) => (
          <li key={round.roundKey}>
            <Link
              href={`/healthcare?healthTab=protocols&round=${encodeURIComponent(round.roundKey)}`}
              aria-label={t("openAria", { name: round.healthPlan.name, date: day(round.startDate) })}
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{round.healthPlan.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t("item", { animals: t("animals", { count: round.animalCount }), date: day(round.startDate) })}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-destructive">
                {t("overdue", { count: round.stepsOverdue })}
                <ChevronRight className="size-4" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 ? <p className="text-xs text-muted-foreground">{t("more", { count: hidden })}</p> : null}
    </section>
  );
}

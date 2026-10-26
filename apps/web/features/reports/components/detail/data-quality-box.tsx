import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Locale } from "@/lib/constants/i18n";
import { formatNumber } from "@/lib/format";
import { resolveBackendKey, type ReportTranslator } from "../../lib/labels";
import type { DataQuality, DataQualityFlags } from "../../types";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Note keys (after `reports.dq.`) that already say what a flag says, so the flag sentence is not repeated. */
const NOTE_COVERS_FLAG: Record<keyof DataQualityFlags, string[]> = {
  incompleteCoverage: ["incomplete_coverage"],
  hasUnsubmittedDrafts: ["unsubmitted_drafts_excluded"],
  hasEstimatedValues: ["estimated_values"],
  hasUnknownCosts: ["unknown_costs", "partial_costs"],
  groupMembershipCurrentOnly: ["group_membership_as_of_generation"],
};
const FLAG_KEY: Record<keyof DataQualityFlags, string> = {
  incompleteCoverage: "dq.incomplete",
  hasUnsubmittedDrafts: "dq.drafts",
  hasEstimatedValues: "dq.estimated",
  hasUnknownCosts: "dq.unknownCosts",
  groupMembershipCurrentOnly: "dq.membership",
};

/** Coverage bar + notes (translated from their keys) + any flag not already explained by a note. */
export function DataQualityBox({
  dataQuality,
  locale,
  tr,
  t,
}: {
  dataQuality: DataQuality;
  locale: Locale;
  tr: ReportTranslator;
  t: Translate;
}) {
  const { expected, recorded } = dataQuality.coverage;
  const hasExpected = expected > 0;
  const pct = hasExpected ? Math.min(100, Math.round((recorded / expected) * 100)) : 0;
  const noteIds = new Set(dataQuality.notes.map((n) => n.replace(/^reports\.dq\./, "")));
  const flagLines = (Object.keys(NOTE_COVERS_FLAG) as (keyof DataQualityFlags)[])
    .filter((flag) => dataQuality.flags?.[flag] && !NOTE_COVERS_FLAG[flag].some((id) => noteIds.has(id)))
    .map((flag) => t(FLAG_KEY[flag]));
  const notes = dataQuality.notes.map((n) => resolveBackendKey(n, tr)).filter(Boolean);
  const lines = [...notes, ...flagLines];

  return (
    <section aria-labelledby="report-dq-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="report-dq-title" className="text-lg font-semibold text-foreground">
          {t("dq.title")}
        </h2>
        {hasExpected ? (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 tabular-nums">
            {pct}%
          </span>
        ) : null}
      </div>
      <Card className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card">
        {hasExpected ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold text-foreground">
                {t("dq.coverage", { recorded: formatNumber(recorded, locale), expected: formatNumber(expected, locale) })}
              </p>
            </div>
            <Progress
              value={pct}
              aria-label={t("dq.coverage", { recorded: formatNumber(recorded, locale), expected: formatNumber(expected, locale) })}
              className="h-2.5 bg-muted"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("dq.noExpected")}</p>
        )}
        {lines.length > 0 ? (
          <ul className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-3.5">
            {lines.map((line, i) => (
              <li key={`${line}-${i}`} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}

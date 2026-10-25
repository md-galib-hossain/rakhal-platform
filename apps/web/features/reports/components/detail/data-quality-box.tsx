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
      <h2 id="report-dq-title" className="text-lg font-semibold text-foreground">
        {t("dq.title")}
      </h2>
      <Card className="flex flex-col gap-3 rounded-xl p-4">
        {hasExpected ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              {t("dq.coverage", { recorded: formatNumber(recorded, locale), expected: formatNumber(expected, locale) })}
            </p>
            <Progress value={pct} aria-label={t("dq.coverage", { recorded: formatNumber(recorded, locale), expected: formatNumber(expected, locale) })} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("dq.noExpected")}</p>
        )}
        {lines.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {lines.map((line, i) => (
              <li key={`${line}-${i}`} className="flex items-start gap-2 text-sm text-muted-foreground">
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

"use client"; // preview trigger + live summary of the form

import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useWatch } from "react-hook-form";
import type { Locale } from "@/lib/constants/i18n";
import { Button } from "@/components/ui/button";
import { useAnimalGroups } from "@/features/cattle/hooks/use-cattle";
import { formatMetricValue, formatPercentChange, periodLabel } from "../../lib/format";
import { reportDomainKey, reportScopeKindKey, resolveBackendKey, resolveMetricLabel, type ReportTranslator } from "../../lib/labels";
import { todayLocalIso } from "@/lib/local-date";
import { reportErrorKeyFor } from "../../lib/errors";
import { datePresetKey } from "../../lib/labels";
import type { ReportSnapshotPayload, TemplateSection } from "../../types";
import { resolveWizardPeriod } from "./period";
import type { Translate, WizardForm } from "./shared";

const HERO_PER_SECTION = 4;

interface Props {
  form: WizardForm;
  sections: TemplateSection[];
  onPreview: () => void;
  previewPending: boolean;
  previewError: unknown;
  /** Snapshot for the CURRENT form values, or null when none/stale. */
  preview: ReportSnapshotPayload | null;
  previewStale: boolean;
  submitErrorKey: string | null;
}

export function ReviewStep({ form, sections, onPreview, previewPending, previewError, preview, previewStale, submitErrorKey }: Props) {
  const t = useTranslations() as unknown as Translate;
  const tw = useTranslations("reportsWizard") as unknown as Translate;
  const locale = useLocale() as Locale;
  const v = useWatch({ control: form.control });
  const groups = useAnimalGroups();
  const selected = new Set(v.selectedMetricIds ?? []);
  const sectionCount = sections.filter((s) => s.metrics.some((m) => selected.has(m.id))).length;
  const view = v.preset ? resolveWizardPeriod(v.preset, todayLocalIso(), { startDate: v.customStartDate, endDate: v.customEndDate }) : null;
  const groupName = groups.data?.items.find((g) => g.id === v.groupId)?.name ?? "";

  const rows: Array<[string, string]> = [
    [tw("review.figures"), tw("review.figuresValue", { count: selected.size, sections: sectionCount })],
    [tw("review.period"), view ? `${t(datePresetKey(v.preset!))}: ${periodLabel(view.period, locale)}` : t(datePresetKey(v.preset!))],
    ...(view ? ([[tw("review.compared"), periodLabel(view.previous, locale)]] as Array<[string, string]>) : []),
    [
      tw("review.animals"),
      v.scopeKind === "GROUP"
        ? tw("review.groupValue", { name: groupName })
        : v.scopeKind === "SINGLE_COW"
          ? tw("review.cowValue")
          : t(reportScopeKindKey(v.scopeKind!)),
    ],
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-3 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([k, val]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium text-foreground">{val}</dd>
          </div>
        ))}
      </dl>

      {submitErrorKey ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive-tint p-3 text-sm" data-testid="generate-error">
          <p className="font-semibold text-destructive">{tw("review.generateError")}</p>
          <p className="text-foreground">{t(submitErrorKey)}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{tw("review.previewHint")}</p>
          <Button type="button" variant="secondary" onClick={onPreview} disabled={previewPending} aria-busy={previewPending}>
            {previewPending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {previewPending ? tw("review.previewing") : t("reports.actions.preview")}
          </Button>
        </div>
        {previewError ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {t(reportErrorKeyFor(previewError))}
          </p>
        ) : null}
        {previewStale ? <p className="text-sm text-muted-foreground">{tw("review.previewStale")}</p> : null}
        {preview ? <PreviewPanel snapshot={preview} t={t} tw={tw} locale={locale} /> : null}
      </div>
    </div>
  );
}

function PreviewPanel({ snapshot, t, tw, locale }: { snapshot: ReportSnapshotPayload; t: Translate; tw: Translate; locale: Locale }) {
  const rt = t as unknown as ReportTranslator;
  const { coverage, notes } = snapshot.dataQuality;
  return (
    <section aria-label={tw("review.previewTitle")} className="flex flex-col gap-3" data-testid="preview-panel">
      <h3 className="text-sm font-semibold text-foreground">
        {tw("review.previewTitle")} · {periodLabel(snapshot.period, locale)}
      </h3>
      {snapshot.sections.map((s) => {
        const scalars = s.metrics.filter((m) => !m.series?.length && !m.rows?.length);
        const hero = scalars.slice(0, HERO_PER_SECTION);
        const more = s.metrics.length - hero.length;
        return (
          <div key={s.id} className="flex flex-col gap-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(reportDomainKey(s.domain))}</h4>
            {hero.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tw("review.previewNoFigures")}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {hero.map((m) => {
                  const change = m.comparison?.previous.state === "value" && m.value.state === "value" ? m.comparison.percentChange : null;
                  const muted = m.value.state !== "value";
                  return (
                    <li key={m.metricId} className="rounded-lg border border-border bg-card p-2.5">
                      <p className="text-xs text-muted-foreground">{resolveMetricLabel(m.metricId, rt)}</p>
                      <p className={muted ? "text-sm text-muted-foreground" : "text-lg font-semibold text-foreground"}>
                        {formatMetricValue(m.value, locale, t)}
                      </p>
                      {change !== null ? (
                        <p className="text-xs text-muted-foreground">{tw("review.previewChange", { change: formatPercentChange(change) })}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {more > 0 ? <p className="text-xs text-muted-foreground">{tw("review.previewMore", { count: more })}</p> : null}
          </div>
        );
      })}
      {coverage.expected > 0 || notes.length > 0 ? (
        <div className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{tw("review.qualityTitle")}</p>
          {coverage.expected > 0 ? <p>{tw("review.coverage", { recorded: coverage.recorded, expected: coverage.expected })}</p> : null}
          <ul className="list-disc pl-4">
            {notes.map((n) => (
              <li key={n}>{resolveBackendKey(n, rt)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{tw("review.previewReadOnly")}</p>
    </section>
  );
}

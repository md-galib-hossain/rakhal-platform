"use client"; // checkbox selection state + expand/collapse per section

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@rakhal/ui/ui/label";
import { reportDomainKey, resolveMetricDefinition, resolveMetricLabel, type ReportTranslator } from "../../lib/labels";
import type { TemplateSection } from "../../types";
import { unitText, type Translate, type WizardForm } from "./shared";

interface Props {
  form: WizardForm;
  sections: TemplateSection[];
  maxMetrics: number;
}

export function CatalogueStep({ form, sections, maxMetrics }: Props) {
  const t = useTranslations() as unknown as Translate;
  const tw = useTranslations("reportsWizard");
  const selected = useWatch({ control: form.control, name: "selectedMetricIds" });
  const selectedSet = new Set(selected);
  const error = form.formState.errors.selectedMetricIds?.message;
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const set = (ids: string[]) => form.setValue("selectedMetricIds", ids, { shouldDirty: true, shouldValidate: form.formState.isSubmitted || !!error });

  function toggleSection(section: TemplateSection, on: boolean) {
    const ids = new Set(selected);
    for (const m of section.metrics) {
      if (on) ids.add(m.id);
      else ids.delete(m.id);
    }
    set([...ids]);
  }
  function toggleMetric(id: string, on: boolean) {
    const ids = new Set(selected);
    if (on) ids.add(id);
    else ids.delete(id);
    set([...ids]);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {tw("catalogue.totalSelected", { selected: selected.length })} · {tw("catalogue.limitHint", { max: maxMetrics })}
      </p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {t(error)}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {sections.map((section) => {
          const count = section.metrics.filter((m) => selectedSet.has(m.id)).length;
          const checked = count === section.metrics.length ? true : count === 0 ? false : "indeterminate";
          const isOpen = !!open[section.id];
          const title = t(reportDomainKey(section.domain));
          const panelId = `wiz-section-${section.id}`;
          return (
            <li
              key={section.id}
              className="rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:border-primary/40"
              data-testid={`section-${section.domain}`}
            >
              <div className="flex items-center gap-3 p-4">
                <Checkbox
                  id={`${panelId}-check`}
                  checked={checked}
                  onCheckedChange={(v) => toggleSection(section, v === true)}
                  aria-label={tw("catalogue.sectionLabel", { section: title })}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${panelId}-check`} className="text-base font-semibold cursor-pointer">
                      {title}
                    </Label>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 tabular-nums">
                      {count} / {section.metrics.length}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tw("catalogue.selectedCount", { selected: count, total: section.metrics.length })}
                  </p>
                </div>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen((o) => ({ ...o, [section.id]: !isOpen }))}
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>{isOpen ? tw("catalogue.hideFigures") : tw("catalogue.showFigures")}</span>
                  <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", isOpen && "rotate-180")} aria-hidden />
                </button>
              </div>
              {isOpen ? (
                <ul id={panelId} className="flex flex-col gap-1 border-t border-border p-3">
                  {section.metrics.map((m) => {
                    const def = resolveMetricDefinition(m.id, t as unknown as ReportTranslator);
                    const unit = unitText(m.unit, t);
                    const id = `${panelId}-${m.id}`;
                    return (
                      <li key={m.id} className="flex items-start gap-3 rounded-md px-1 py-2">
                        <Checkbox id={id} checked={selectedSet.has(m.id)} onCheckedChange={(v) => toggleMetric(m.id, v === true)} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <Label htmlFor={id} className="leading-snug">
                            {resolveMetricLabel(m.id, t as unknown as ReportTranslator)}
                            {unit ? <span className="ml-2 text-xs font-normal text-muted-foreground">({unit})</span> : null}
                          </Label>
                          {def ? <p className="mt-0.5 text-xs text-muted-foreground">{def}</p> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

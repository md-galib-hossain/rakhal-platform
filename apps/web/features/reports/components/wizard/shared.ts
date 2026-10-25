import { format } from "date-fns";
import type { UseFormReturn } from "react-hook-form";
import type { ReportWizardFormValues } from "../../schemas";
import type { ReportTemplatesResponse, TemplateSection } from "../../types";
import { unitLabelKey } from "../../lib/format";

export type WizardForm = UseFormReturn<ReportWizardFormValues>;
export type Translate = ((key: string, values?: Record<string, string | number>) => string) & {
  has: (key: string) => boolean;
};

export const WIZARD_STEP_FIELDS = {
  report: ["selectedMetricIds"],
  period: ["preset", "customStartDate", "customEndDate"],
  scope: ["scopeKind", "cattleId", "groupId"],
} as const;

export const dateToYmd = (d: Date) => format(d, "yyyy-MM-dd");
export const ymdToDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function allMetricIds(sections: TemplateSection[]): string[] {
  return sections.flatMap((s) => s.metrics.map((m) => m.id as string));
}

export function catalogueSections(templates: ReportTemplatesResponse): TemplateSection[] {
  return templates.onDemand.sections.filter((s) => s.metrics.length > 0);
}

/** Short unit text for the catalogue ("L", "kg", "৳", "%"); empty for plain counts. */
export function unitText(unit: string, t: Translate): string {
  if (unit === "BDT") return "৳";
  if (unit === "%") return "%";
  if (unit === "count" || unit === "") return "";
  if (unit === "BDT/cow-day" || unit === "BDT/L") {
    const k = unitLabelKey(unit);
    return k ? `৳ ${t(k)}` : "৳";
  }
  const k = unitLabelKey(unit);
  return k ? t(k) : unit;
}

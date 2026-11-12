"use client"; // locale + translators

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/constants/i18n";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  periodLabel,
  reportErrorCategoryKey,
  reportOriginKey,
  reportStatusKey,
  reportTypeKey,
  type ReportSummary,
} from "@/features/reports";

/** Display strings for a report row/card/summary card, in the active locale. Pure formatting, no data fetching. */
export function useReportLabels() {
  const locale = useLocale() as Locale;
  const t = useTranslations();
  return {
    status: (r: Pick<ReportSummary, "status">) => t(reportStatusKey(r.status)),
    type: (r: Pick<ReportSummary, "type">) => t(reportTypeKey(r.type)),
    origin: (r: Pick<ReportSummary, "origin">) => t(reportOriginKey(r.origin)),
    period: (r: Pick<ReportSummary, "period">) => periodLabel(r.period, locale),
    /** Safe, localized failure text from the error category; never the backend's free text. */
    failure: (r: Pick<ReportSummary, "errorCategory">) => t(reportErrorCategoryKey(r.errorCategory)),
    /** When the report finished (or, while still generating, when it was requested). */
    generatedAt: (r: Pick<ReportSummary, "completedAt" | "createdAt">) => {
      const iso = r.completedAt ?? r.createdAt;
      return { relative: formatRelativeTime(iso, locale), absolute: formatDateTime(iso, locale), iso };
    },
  };
}

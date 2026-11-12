"use client"; // next-intl hooks

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/constants/i18n";
import type { ReportTranslator } from "../../lib/labels";

/** One place the detail components get: own namespace `t`, root translator `tr` (labels/units/errors), locale. */
export function useReportI18n() {
  const t = useTranslations("reportsDetail");
  const tr = useTranslations() as unknown as ReportTranslator;
  const locale = useLocale() as Locale;
  return { t, tr, locale };
}

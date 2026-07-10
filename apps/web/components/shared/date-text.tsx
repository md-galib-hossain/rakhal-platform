"use client"; // reads the active next-intl locale to format dates

import { useLocale } from "next-intl";
import { formatDate, formatRelativeTime } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";

export interface DateTextProps extends React.HTMLAttributes<HTMLTimeElement> {
  date: Date | string;
  options?: Intl.DateTimeFormatOptions;
  /** Renders "2 hours ago" style instead of a calendar date — for activity feeds. */
  relative?: boolean;
}

/** Locale-aware date rendering — wraps `lib/format.ts#formatDate`/`formatRelativeTime`. */
export function DateText({ date, options, relative = false, ...props }: DateTextProps) {
  const locale = useLocale() as Locale;
  const iso = typeof date === "string" ? date : date.toISOString();
  return (
    <time dateTime={iso} {...props}>
      {relative ? formatRelativeTime(date, locale) : formatDate(date, locale, options)}
    </time>
  );
}

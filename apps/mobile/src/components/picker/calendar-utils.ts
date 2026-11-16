/**
 * Pure calendar calculation utilities for DateRangePicker.
 * All functions are deterministic and pure: easy to test and verify.
 */
import { applyDigits, MONTHS_LONG, type DigitSystem, type Locale } from '@rakhal/domain';

export interface CalendarDay {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dateKey: string; // "YYYY-MM-DD"
  isCurrentMonth: boolean;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseDateKey(key: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Returns 0 for Sunday .. 6 for Saturday */
export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

export function isSameDay(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b;
}

export function isDateBefore(a: string, b: string): boolean {
  return a < b;
}

export function isDateAfter(a: string, b: string): boolean {
  return a > b;
}

export function isBetween(target: string, start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return false;
  return target > start && target < end;
}

export function getCalendarGrid(year: number, month: number): (CalendarDay | null)[] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const cells: (CalendarDay | null)[] = [];

  // Padding cells before the first day of month
  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      year,
      month,
      day,
      dateKey: formatDateKey(year, month, day),
      isCurrentMonth: true,
    });
  }

  return cells;
}

export function formatMonthYearHeader(
  year: number,
  month: number,
  locale: Locale,
  digits: DigitSystem,
): string {
  const monthName = MONTHS_LONG[locale][month - 1] ?? '';
  const yearString = applyDigits(String(year), digits);
  return `${monthName} ${yearString}`;
}

export const DAY_OF_WEEK_LABELS: Record<Locale, readonly string[]> = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  bn: ['র', 'সো', 'ম', 'বু', 'বৃ', 'শু', 'শ'],
};

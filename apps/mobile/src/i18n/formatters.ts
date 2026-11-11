/**
 * Pure formatter binder (no React, no React Native: node --test imports this file).
 * @rakhal/domain only: no Intl, no toLocale*. Money groups as lakh/crore in both locales (only digits vary);
 * dates are fixed Asia/Dhaka.
 */
import {
  farmDayKey,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
  type DateStyle,
  type DigitSystem,
  type Locale,
  type NumberFormatOptions,
} from '@rakhal/domain';

export interface Formatters {
  locale: Locale;
  digits: DigitSystem;
  /** "৳12,50,000" (Latin digits) or "৳১২,৫০,০০০" (Bangla digits). `fractionDigits` default 0. */
  money: (amount: number, opts?: { fractionDigits?: number }) => string;
  number: (value: number, opts?: Omit<NumberFormatOptions, 'digits'>) => string;
  date: (input: Date | number, style?: DateStyle) => string;
  dateTime: (input: Date | number, style?: DateStyle) => string;
  /** 24-hour "HH:mm" in Dhaka time. */
  time: (input: Date | number) => string;
  /** Farm day of record, "YYYY-MM-DD" in Dhaka time (Latin digits: it is a key, not display text). */
  farmDay: (input: Date | number) => string;
  /**
   * Render-safe variants: identical output, but a RangeError from the domain formatter (NaN/Infinity, out-of-range
   * date, bad fractionDigits) yields SAFE_PLACEHOLDER instead of crashing the screen. Other errors still throw.
   * Use these for server/user data in render paths; the throwing originals stay for code that wants the error.
   */
  moneySafe: Formatters['money'];
  numberSafe: Formatters['number'];
  dateSafe: Formatters['date'];
  dateTimeSafe: Formatters['dateTime'];
  timeSafe: Formatters['time'];
}

/** Shown in place of a value that cannot be formatted. */
export const SAFE_PLACEHOLDER = '—';

function safely<A extends unknown[]>(fn: (...args: A) => string): (...args: A) => string {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      if (error instanceof RangeError) return SAFE_PLACEHOLDER;
      throw error;
    }
  };
}

export function bindFormatters(locale: Locale, digits: DigitSystem): Formatters {
  const money: Formatters['money'] = (amount, opts) => formatMoney(amount, { ...opts, digits });
  const number: Formatters['number'] = (value, opts) => formatNumber(value, { ...opts, digits });
  const date: Formatters['date'] = (input, style) =>
    formatDate(input, { locale, digits, ...(style === undefined ? {} : { style }) });
  const dateTime: Formatters['dateTime'] = (input, style) =>
    formatDateTime(input, { locale, digits, ...(style === undefined ? {} : { style }) });
  const time: Formatters['time'] = (input) => formatTime(input, digits);
  return {
    locale,
    digits,
    money,
    number,
    date,
    dateTime,
    time,
    farmDay: (input) => farmDayKey(input),
    moneySafe: safely(money),
    numberSafe: safely(number),
    dateSafe: safely(date),
    dateTimeSafe: safely(dateTime),
    timeSafe: safely(time),
  };
}

"use client"; // reads the active locale (via @rakhal/ui's LocaleProvider) to format ৳ amounts

import { cn } from "../../lib/utils";
import { formatMoney, useLocale } from "../../lib/locale";

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
  /** Tints the amount green (positive) / red (negative) — for P&L rows. */
  colorize?: boolean;
}

/** Locale-aware ৳ rendering (lakh grouping, Latin digits) — wraps `lib/locale.ts#formatMoney`. */
export function MoneyText({ amount, colorize = false, className, ...props }: MoneyTextProps) {
  const locale = useLocale();
  return (
    <span
      className={cn(
        colorize && (amount < 0 ? "text-destructive" : amount > 0 ? "text-success" : undefined),
        className,
      )}
      {...props}
    >
      {formatMoney(amount, locale)}
    </span>
  );
}

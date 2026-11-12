"use client"; // reads the active next-intl locale to format ৳ amounts

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
  /** Tints the amount green (positive) / red (negative) — for P&L rows. */
  colorize?: boolean;
}

/** Locale-aware ৳ rendering (lakh grouping, Latin digits) — wraps `lib/format.ts#formatMoney`. */
export function MoneyText({ amount, colorize = false, className, ...props }: MoneyTextProps) {
  const locale = useLocale() as Locale;
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

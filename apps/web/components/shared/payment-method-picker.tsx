"use client"; // selection state is owned by the caller; the buttons carry click handlers

import { cn } from "@/lib/utils";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types/payment";

/**
 * One-tap payment-method choice (Cash · Bank · Mobile banking). Replaces the per-dialog `<Select>`
 * over `PAYMENT_METHODS` that every money form re-implemented: three options never need a
 * dropdown, and a visible default (the caller seeds `value` with "CASH") means a farmer taking
 * cash never has to touch it.
 *
 * Presentation only — labels come from the caller's own i18n namespace so this stays in
 * `components/shared` without owning any copy.
 */
export function PaymentMethodPicker({
  value,
  onChange,
  labels,
  groupLabel,
  disabled,
  className,
}: {
  value: PaymentMethod | undefined;
  onChange: (method: PaymentMethod) => void;
  /** Visible text per method. */
  labels: Record<PaymentMethod, string>;
  /** Accessible name of the whole group (also shown as the small caption above it). */
  groupLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-xs text-muted-foreground">{groupLabel}</p>
      <div role="radiogroup" aria-label={groupLabel} className="flex gap-2">
        {PAYMENT_METHODS.map((method) => {
          const selected = value === method;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(method)}
              className={cn(
                "flex h-11 flex-1 items-center justify-center rounded-lg border bg-card px-2 text-sm font-medium transition-colors disabled:opacity-50",
                selected ? "border-primary bg-success-tint text-primary" : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              {labels[method]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

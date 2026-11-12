"use client"; // local edit-buffer state (raw vs formatted display) + reads the active locale

import { forwardRef, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";

/**
 * RAKHAL-355 — controlled ৳ amount input. No such shared component existed before this ticket;
 * every money field in the app hand-rolled `LabeledInput type="number" step="0.01"` plus a
 * `setValueAs` adapter to turn the empty string into `undefined` instead of `NaN` — see
 * `record-transaction-dialog.tsx:44`'s `numberField` (the exact pattern this replaces, though that
 * file itself is V1/frozen and not touched here).
 *
 * Value contract: `number | undefined` — a plain JS number, matching every existing money DTO field
 * in this codebase (`CreateTransactionPayload.amount`, `CreateFinancialAccountDto.openingBalance`,
 * etc. are all `number`, not a string-encoded Decimal) and the V2 backend's own
 * `src/common/money.ts#toStorage` convention of accepting a plain number and converting internally.
 * `undefined` for "empty" — never `NaN`/`0` — so a required-field zod check (`z.number().min(0.01)`)
 * fails cleanly on an untouched field instead of silently validating `0`.
 *
 * Display contract: while the field is **not** focused, the value renders through
 * `lib/format.ts#formatNumber` (lakh grouping, Latin digits in both locales — same convention
 * `MoneyText`/`formatMoney` use for read-only amounts) so a farmer reviewing a filled form sees
 * "৳1,25,000" not "125000". While focused, it swaps to the raw digit string the farmer is actively
 * typing — grouping commas while mid-edit would fight cursor position on every keystroke, the same
 * reason `DatePicker` swaps between a formatted display and its own popover state. The ৳ glyph is a
 * fixed prefix outside the editable text (not part of the value), so it's never something a farmer
 * has to type around or delete.
 *
 * Wiring: `Controller`-based, matching `components/ui/date-picker.tsx#DatePicker`'s shape exactly
 * (plain `value`/`onChange`/`onBlur`/`error` props, no `register()` — a non-native control can't be
 * spread onto `register()`'s ref/onChange/onBlur triplet the way a real `<input>` can):
 *
 * ```tsx
 * <Controller
 *   control={form.control}
 *   name="amount"
 *   render={({ field, fieldState }) => (
 *     <MoneyInput label={t("amount")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
 *   )}
 * />
 * ```
 */
export interface MoneyInputProps {
  id?: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  /** Floor applied on blur if the typed value dips below it (default `0` — money amounts don't go
   * negative in this app; every DTO field this feeds uses `@Min(0)`/`z.number().min(...)`). Pass
   * `undefined` to disable clamping entirely (e.g. a signed adjustment field, if one is ever added). */
  min?: number;
  className?: string;
}

/** Turns a user-typed money string into a plain `number | undefined`, tolerant of a leading `-`
 * (kept, not stripped, so `min` clamping on blur — not this parser — is the single place negative
 * values get rejected) and a single decimal point. Exported standalone, independent of any
 * component/DOM state, specifically so it's unit-testable without mounting `MoneyInput`. */
export function parseMoneyInput(raw: string): number | undefined {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Rejects a keystroke that would produce something `parseMoneyInput` can't cleanly round-trip
 * (a second decimal point, a `-` anywhere but the front, stray letters) — applied on every
 * `onChange` so the raw edit-buffer itself never drifts into a shape the parser would reject. */
function isValidMoneyDraft(raw: string): boolean {
  return /^-?\d*\.?\d*$/.test(raw);
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { id, label, value, onChange, onBlur, placeholder, error, disabled, min = 0, className },
  ref,
) {
  const locale = useLocale() as Locale;
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(value != null ? String(value) : "");

  // Keep the edit buffer in sync with an externally-changed `value` (e.g. `form.reset()`) — but
  // only while not focused, so an external update never clobbers what the farmer is mid-typing.
  useEffect(() => {
    if (!focused) setRaw(value != null ? String(value) : "");
  }, [value, focused]);

  const display = focused ? raw : value != null ? formatNumber(value, locale, { maximumFractionDigits: 2 }) : "";

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-input bg-card px-4 py-2 shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring",
          error && "border-destructive focus-within:ring-destructive",
          disabled && "opacity-50",
        )}
      >
        <span className="text-sm text-muted-foreground" aria-hidden="true">
          ৳
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <label htmlFor={id} className="text-xs text-muted-foreground">
            {label}
          </label>
          <input
            ref={ref}
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            placeholder={placeholder}
            value={display}
            aria-invalid={!!error}
            className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            onFocus={() => {
              setFocused(true);
              setRaw(value != null ? String(value) : "");
            }}
            onChange={(e) => {
              const next = e.target.value;
              if (!isValidMoneyDraft(next)) return;
              setRaw(next);
              onChange(parseMoneyInput(next));
            }}
            onBlur={() => {
              setFocused(false);
              if (min != null && value != null && value < min) onChange(min);
              onBlur?.();
            }}
          />
        </div>
      </div>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
});

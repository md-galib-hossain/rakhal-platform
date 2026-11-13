"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SelectTrigger, SelectValue } from "@rakhal/ui/ui/select";

/**
 * Stacked label-inside-value field container — matches the Figma "Add New Cattle" modal's input
 * style (`rakhal-ui-analysis.md` B1-S4): the label sits as a small line *inside* the bordered box,
 * above the value, rather than as a placeholder or a border-overlapping floating label (that's
 * `FloatingInput`, a different Figma component used only on the auth screens). Shared here because
 * every future "Add X" modal (calves, milk buyers, …) uses the same field chrome per the design
 * system's `FieldGroup` component note.
 */
export interface LabeledInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** Decorative trailing icon (e.g. a calendar glyph on a date field) — purely visual. */
  endIcon?: React.ReactNode;
  inputClassName?: string;
  containerClassName?: string;
}

export const LabeledInput = forwardRef<HTMLInputElement, LabeledInputProps>(function LabeledInput(
  { label, error, endIcon, className, inputClassName, containerClassName, id, ...props },
  ref,
) {
  return (
    <div className={cn("w-full", containerClassName, className)}>
      <div
        className={cn(
          "flex min-h-[56px] items-center gap-2 rounded-xl border border-input bg-card px-4 py-2 shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed",
          error && "border-destructive focus-within:ring-destructive",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <label htmlFor={id} className="text-xs text-muted-foreground select-none">
            {label}
          </label>
          <input
            ref={ref}
            id={id}
            className={cn(
              "w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground",
              inputClassName,
            )}
            aria-invalid={!!error}
            {...props}
          />
        </div>
        {endIcon}
      </div>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
});

export interface LabeledSelectTriggerProps extends React.ComponentProps<typeof SelectTrigger> {
  label: string;
  placeholder?: string;
  error?: string;
}

/** Same stacked-label chrome as `LabeledInput`, for a Radix `<Select>` trigger. Use inside
 * `<Select>...</Select>` in place of the plain `SelectTrigger`. */
export function LabeledSelectTrigger({
  label,
  placeholder,
  error,
  className,
  ...props
}: LabeledSelectTriggerProps) {
  return (
    <SelectTrigger
      className={cn(
        "relative flex min-h-[56px] h-auto flex-col items-start justify-center gap-0 rounded-xl border-input bg-card px-4 py-2 text-left shadow-xs [&>svg]:absolute [&>svg]:right-4 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2",
        error && "border-destructive focus:ring-destructive",
        className,
      )}
      {...props}
    >
      <span className="text-xs text-muted-foreground select-none">{label}</span>
      <SelectValue placeholder={placeholder} className="text-sm text-foreground" />
    </SelectTrigger>
  );
}

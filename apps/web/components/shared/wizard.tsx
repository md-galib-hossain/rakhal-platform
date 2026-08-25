"use client"; // step index state + async validate-before-advance

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * RAKHAL-355 — generic multi-step wizard, extracted from the 3 hand-rolled step-indicator +
 * `trigger()`-before-advance implementations already in the codebase (same shape, copy-pasted each
 * time): `features/finance/components/record-transaction-dialog.tsx`'s `StepProgress` (~line 99) +
 * its `goNext`'s `form.trigger(fieldsToValidate)` (~line 246-259), `features/health/components/
 * create-health-plan-dialog.tsx`'s own `StepProgress` (~line 69) + `goNext` (~line 108-114), and
 * `features/tasks/components/create-task-sheet.tsx`'s equivalent. All three: a thin progress-bar
 * strip, a title/subtitle pair per step, per-step field validation before advancing, Back/Continue/
 * Submit in a fixed footer.
 *
 * Deliberately generic over the *caller's* form/fields — this component knows nothing about
 * react-hook-form. It hands the current step's declared `fields` to `onValidateStep` and waits for
 * a boolean; the caller decides how validation actually happens (`form.trigger(fields)` today, but
 * nothing here assumes that — a future step could validate against something else entirely). This
 * matters for RAKHAL-357's Record Sale wizard, which the ticket explicitly calls out as "very
 * different" from the old finance dialog (per sale-type field sets, live available-quantity checks
 * that aren't pure zod validation) — a wizard shape baked around one `useForm` instance would not
 * have served that later ticket.
 *
 * Content itself is **not** owned by the wizard — each `WizardStep.content` is caller-supplied
 * `ReactNode`, so this component only ever renders chrome (progress strip, title, footer buttons),
 * never form fields. Callers stay in full control of their own `<form>`/`Controller` wiring.
 */
export interface WizardStep<TFieldName extends string = string> {
  /** Stable identity for the progress-strip segment and React key — not shown to the user. */
  key: string;
  title: string;
  subtitle?: string;
  /** Field names this step owns, handed to `onValidateStep` before advancing past it. Optional —
   * a step with no fields (e.g. a pure review/summary step) always validates as `true`. */
  fields?: TFieldName[];
  content: ReactNode;
}

export interface WizardProps<TFieldName extends string = string> {
  steps: WizardStep<TFieldName>[];
  /** Validate the given step's fields before advancing (Next) or finishing (Submit on the last
   * step). Mirrors `record-transaction-dialog.tsx`'s inline
   * `await form.trigger(fieldsToValidate)` — pass `(fields) => form.trigger(fields ?? [])` for a
   * react-hook-form caller. Return `true` for a step with nothing to validate. */
  onValidateStep: (fields: TFieldName[] | undefined, stepIndex: number) => boolean | Promise<boolean>;
  /** Called once validation passes on the last step. */
  onSubmit: () => void | Promise<void>;
  /** Called instead of stepping back when already on the first step (e.g. close the dialog). If
   * omitted, the Back/Cancel button is simply disabled on the first step. */
  onCancel?: () => void;
  submitting?: boolean;
  submitLabel: string;
  cancelLabel: string;
  backLabel: string;
  nextLabel: string;
  /** e.g. `(step, total) => t("stepOf", { step, total })` — kept a caller-supplied formatter
   * rather than a fixed English string so every consumer stays on the house i18n convention. */
  stepOfLabel: (step: number, total: number) => string;
  /** Controlled step index — supply alongside `onStepChange` if a caller needs to jump/reset steps
   * from outside (e.g. resetting to step 1 after a successful submit). Uncontrolled otherwise. */
  step?: number;
  onStepChange?: (step: number) => void;
  className?: string;
}

/** The progress-strip alone, exported standalone in case a caller wants to render it outside the
 * wizard's own layout (e.g. a header that sits above a scroll container the footer sits below). */
export function WizardStepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-0.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-primary-hover" : "bg-muted")} />
      ))}
    </div>
  );
}

export function Wizard<TFieldName extends string = string>({
  steps,
  onValidateStep,
  onSubmit,
  onCancel,
  submitting = false,
  submitLabel,
  cancelLabel,
  backLabel,
  nextLabel,
  stepOfLabel,
  step: controlledStep,
  onStepChange,
  className,
}: WizardProps<TFieldName>) {
  const [uncontrolledStep, setUncontrolledStep] = useState(0);
  const stepIndex = controlledStep ?? uncontrolledStep;
  const setStepIndex = onStepChange ?? setUncontrolledStep;

  const current = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  async function handleAdvance() {
    if (submitting) return;
    const valid = await onValidateStep(current.fields, stepIndex);
    if (!valid) return;
    if (isLast) {
      await onSubmit();
      return;
    }
    setStepIndex(Math.min(stepIndex + 1, steps.length - 1));
  }

  function handleBack() {
    if (submitting) return;
    if (isFirst) {
      onCancel?.();
      return;
    }
    setStepIndex(Math.max(stepIndex - 1, 0));
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex flex-col gap-3 pb-5">
        <p className="text-xs text-muted-foreground">{stepOfLabel(stepIndex + 1, steps.length)}</p>
        <WizardStepProgress step={stepIndex + 1} total={steps.length} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <div>
          <p className="text-base font-medium text-foreground">{current.title}</p>
          {current.subtitle ? <p className="text-xs text-muted-foreground">{current.subtitle}</p> : null}
        </div>
        {current.content}
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="secondary" className="flex-1" disabled={submitting || (isFirst && !onCancel)} onClick={handleBack}>
          {isFirst ? cancelLabel : backLabel}
        </Button>
        <Button type="button" className="flex-1" disabled={submitting} onClick={handleAdvance}>
          {isLast ? (submitting ? "…" : submitLabel) : nextLabel}
        </Button>
      </div>
    </div>
  );
}

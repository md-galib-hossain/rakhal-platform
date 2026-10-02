"use client"; // multi-step wizard state + form

import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Bug, ClipboardList, HeartPulse, Plus, Stethoscope, Syringe, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreatePlan, useUpdatePlan } from "../hooks/use-health";
import { HEALTH_CONDITIONS } from "./report-sickness/condition-chips";
import { createHealthPlanFormSchema, type CreateHealthPlanFormInput } from "../schemas";
import type { CreateHealthPlanPayload, HealthPlanListItem } from "../types";

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

const CATEGORY_CARDS = [
  { value: "TREATMENT", icon: Stethoscope },
  { value: "PREVENTION", icon: Plus },
  { value: "VACCINATION", icon: Syringe },
  { value: "DEWORMING", icon: Bug },
  { value: "BREEDING", icon: HeartPulse },
  { value: "ROUTINE", icon: ClipboardList },
] as const;

// `CreateHealthPlanDto` needs both a fine-grained `category` (HealthPlanCategory, 6 values — drives
// e.g. the diagnosis type when a plan is applied) and a coarse `planType` (HealthPlanType, 4 values —
// drives the card's badge/list filter). Asking the user for both separately used to read as the same
// question twice, since their values overlap (PREVENTION/BREEDING exist in both enums). `category`
// is strictly the more specific of the two, so it's the only thing asked here — `planType` is derived
// from it below and never shown as its own field. GENERAL (no `category` maps to it 1:1) is reserved
// for ROUTINE, the one category with no obvious MEDICAL/PREVENTION/BREEDING home.
const CATEGORY_TO_PLAN_TYPE: Record<CreateHealthPlanFormInput["category"], CreateHealthPlanFormInput["planType"]> = {
  TREATMENT: "MEDICAL",
  PREVENTION: "PREVENTION",
  VACCINATION: "PREVENTION",
  DEWORMING: "PREVENTION",
  BREEDING: "BREEDING",
  ROUTINE: "GENERAL",
};

function toPayload(values: CreateHealthPlanFormInput, isEdit: boolean): CreateHealthPlanPayload {
  // Only treatment protocols carry a condition. `null` clears it on update; a create just leaves it out.
  const condition = values.category === "TREATMENT" ? (values.condition ?? null) : null;
  return {
    name: values.name,
    category: values.category,
    planType: values.planType,
    cycleLengthDays: values.cycleLengthDays,
    description: values.description || undefined,
    ...(isEdit ? { condition } : condition ? { condition } : {}),
    steps: values.steps.map((step, index) => {
      const title = step.medicineName || `Day ${step.dayNumber} action ${index + 1}`;
      return {
        dayNumber: step.dayNumber,
        title,
        actionType: step.medicineName ? "MEDICINE" : "OBSERVATION",
        instruction: title,
        medicineName: step.medicineName || undefined,
        doseAmount: step.doseAmount,
      };
    }),
  };
}

function toFormDefaults(plan: HealthPlanListItem | undefined): Partial<CreateHealthPlanFormInput> {
  if (!plan) {
    return { steps: [{ dayNumber: 1, medicineName: "" }] };
  }
  return {
    planType: plan.planType,
    name: plan.name,
    category: plan.category,
    cycleLengthDays: plan.cycleLengthDays ?? 1,
    description: plan.description ?? "",
    condition: plan.condition,
    steps: plan.steps.map((step) => ({
      dayNumber: step.dayNumber,
      medicineName: step.medicineName ?? "",
      doseAmount: step.doseAmount ?? undefined,
      doseUnit: step.doseUnit ?? "",
    })),
  };
}

function StepProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((s) => (
        <div key={s} className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-primary-hover" : "bg-muted")} />
      ))}
    </div>
  );
}

/**
 * "Create New Health Plan" 3-step wizard — Figma 734:47059 (Step 1: pick `category`, see
 * `CATEGORY_TO_PLAN_TYPE` for why the mock's `planType` picker was folded into this single question)
 * /734:47993 (Step 2: name/cycleLength/description) /734:48743 (Step 3: Action Sequence Builder —
 * day-by-day rows), `get_design_context`. Mirrors `CreateHealthPlanDto`/`HealthPlanStepDto` exactly.
 * Reused for editing (`plan` prop set) — the mock only shows the create flow, but reusing it for
 * "Edit Plan" (rather than building a second near-identical dialog) needed no new fields, just a
 * `PATCH` instead of `POST` on submit.
 */
export function CreateHealthPlanDialog({ open, onOpenChange, plan }: { open: boolean; onOpenChange: (open: boolean) => void; plan?: HealthPlanListItem }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <CreateHealthPlanDialogBody key={plan?.id ?? "create"} onOpenChange={onOpenChange} plan={plan} /> : null}
    </Sheet>
  );
}

function CreateHealthPlanDialogBody({ onOpenChange, plan }: { onOpenChange: (open: boolean) => void; plan?: HealthPlanListItem }) {
  const t = useTranslations("health.healthPlan.createDialog");
  const tCondition = useTranslations("health.reportSickness");
  const isEdit = Boolean(plan);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const pending = createPlan.isPending || updatePlan.isPending;

  const form = useForm<CreateHealthPlanFormInput>({
    resolver: zodResolver(createHealthPlanFormSchema),
    defaultValues: toFormDefaults(plan),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "steps" });
  const category = useWatch({ control: form.control, name: "category" });

  async function goNext() {
    const fieldsToValidate: (keyof CreateHealthPlanFormInput)[] =
      step === 1 ? ["category"] : step === 2 ? ["name", "cycleLengthDays"] : [];
    const valid = await form.trigger(fieldsToValidate);
    if (valid) setStep((s) => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)));
  }

  async function onSubmit(values: CreateHealthPlanFormInput) {
    try {
      if (isEdit && plan) {
        await updatePlan.mutateAsync({ id: plan.id, dto: toPayload(values, true) });
      } else {
        await createPlan.mutateAsync(toPayload(values, false));
      }
      toast.success(isEdit ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleFormSubmit(values: CreateHealthPlanFormInput) {
    if (step < 3) {
      await goNext();
      return;
    }
    await onSubmit(values);
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[600px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[600px]"
    >
      <div className="flex items-start justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        <button type="button" onClick={() => onOpenChange(false)} aria-label={t("close")} className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70">
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      {/* Enter inside an input advances the wizard instead of submitting it early. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && step < 3 && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            void goNext();
          }
        }}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-4">
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">{t("stepOf", { step, total: 3 })}</p>
            <StepProgress step={step} />
          </div>

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-base font-medium text-foreground">{t("step1Title")}</p>
                <p className="text-xs text-muted-foreground">{t("step1Subtitle")}</p>
              </div>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <div className="flex flex-col gap-3">
                    {CATEGORY_CARDS.map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          field.onChange(value);
                          form.setValue("planType", CATEGORY_TO_PLAN_TYPE[value]);
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          field.value === value ? "border-primary bg-success-tint" : "border-border",
                        )}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{t(`categoryOptions.${value}`)}</span>
                          <span className="text-xs text-muted-foreground">{t(`categoryDescriptions.${value}`)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-base font-medium text-foreground">{t("step2Title")}</p>
                <p className="text-xs text-muted-foreground">{t("step2Subtitle")}</p>
              </div>
              <LabeledInput id="name" label={t("planName")} placeholder={t("planNamePlaceholder")} {...form.register("name")} error={form.formState.errors.name?.message} />
              <LabeledInput
                id="cycleLengthDays"
                type="number"
                min={1}
                label={t("cycleLength")}
                endIcon={<span className="text-xs text-muted-foreground">{t("days")}</span>}
                {...form.register("cycleLengthDays", numberField)}
                error={form.formState.errors.cycleLengthDays?.message}
              />
              <div>
                <Textarea id="description" placeholder={t("descriptionPlaceholder")} className="h-20" {...form.register("description")} />
                <label htmlFor="description" className="mt-1 block text-xs text-muted-foreground">
                  {t("description")}
                </label>
              </div>
              {category === "TREATMENT" ? (
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">{t("condition")}</p>
                    <p className="text-xs text-muted-foreground">{t("conditionHint")}</p>
                  </div>
                  <Controller
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <div role="radiogroup" aria-label={t("condition")} className="flex flex-wrap gap-2">
                        {HEALTH_CONDITIONS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            role="radio"
                            aria-checked={field.value === c}
                            // Tapping the chosen one again clears it — the field is optional.
                            onClick={() => field.onChange(field.value === c ? null : c)}
                            className={cn(
                              "min-h-9 rounded-lg border px-3 text-sm font-medium transition-colors",
                              field.value === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30",
                            )}
                          >
                            {tCondition(`conditionValue.${c}`)}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-base font-medium text-foreground">{t("step3Title")}</p>
                <p className="text-xs text-muted-foreground">{t("step3Subtitle")}</p>
              </div>
              <div className="flex flex-col gap-3">
                {fields.map((fieldItem, index) => (
                  <div key={fieldItem.id} className="flex items-center gap-4">
                    <div className="flex flex-1 items-center gap-2">
                      <div className="w-[60px] shrink-0">
                        <LabeledInput id={`steps.${index}.dayNumber`} type="number" min={1} label={t("day")} {...form.register(`steps.${index}.dayNumber`, numberField)} />
                      </div>
                      <div className="flex-1">
                        <LabeledInput
                          id={`steps.${index}.medicineName`}
                          label={t("medicine")}
                          placeholder={t("medicinePlaceholder")}
                          {...form.register(`steps.${index}.medicineName`)}
                          error={form.formState.errors.steps?.[index]?.medicineName?.message}
                        />
                      </div>
                      <div className="w-[64px] shrink-0">
                        <LabeledInput id={`steps.${index}.doseAmount`} type="number" min={0} label={t("dose")} {...form.register(`steps.${index}.doseAmount`, numberField)} />
                      </div>
                      <div className="w-[64px] shrink-0">
                        <LabeledInput id={`steps.${index}.doseUnit`} label={t("doseUnit")} placeholder={t("doseUnitPlaceholder")} {...form.register(`steps.${index}.doseUnit`)} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                      aria-label={t("removeDay")}
                      className="flex size-6 items-center justify-center rounded text-destructive transition-opacity hover:opacity-70 disabled:opacity-30"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="flex w-fit items-center gap-1.5 text-xs font-medium text-primary"
                onClick={() => append({ dayNumber: fields.length + 1, medicineName: "" })}
              >
                {t("addAnotherDay")}
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-2 pt-5">
          <Button
            type="button"
            variant="secondary"
            className="h-[52px] flex-1 rounded-xl"
            onClick={() => (step === 1 ? onOpenChange(false) : setStep((s) => ((s - 1) as 1 | 2 | 3)))}
            disabled={pending}
          >
            {step === 1 ? t("cancel") : t("back")}
          </Button>
          {step < 3 ? (
            <Button type="button" className="h-[52px] flex-1 rounded-xl" onClick={goNext}>
              {t("continue")}
            </Button>
          ) : (
            <Button type="submit" className="h-[52px] flex-1 rounded-xl" disabled={pending}>
              {pending ? "…" : isEdit ? t("saveChanges") : t("deployPlan")}
            </Button>
          )}
        </div>
      </form>
    </SheetContent>
  );
}

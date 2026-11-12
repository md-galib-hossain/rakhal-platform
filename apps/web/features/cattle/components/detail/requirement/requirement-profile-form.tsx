"use client"; // react-hook-form state, live derived figures and a save mutation

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Info, RotateCcw, X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSetRequirementOverride } from "@/features/feed/hooks/use-requirement-override";
import { requirementOverrideFormSchema, type RequirementOverrideFormValues } from "@/features/feed/schemas";
import type { FeedRequirements, RequirementOverrideWarning } from "@/features/feed/types";
import { PROFILE_SECTIONS, asField, fmt, type EditableKey } from "./profile";

/** Info icon + "how this is worked out" tooltip — same as the read-only table's. */
function FormulaHint({ formulaKey }: { formulaKey: string }) {
  const t = useTranslations("cattle.feeding.requirement.formula");
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("triggerLabel")}>
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{t(formulaKey)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Hand-set the whole nutrient profile (MILESTONE 28b, RFE-131). Every row starts at the value in force (or the
 * last manual one, or today's calculated figure) and shows the calculated benchmark beside it, with a quick reset.
 * Derived rows (energy density, CP %, NEL, Ca:P) calculate live from what is typed.
 */
export function RequirementProfileForm({
  cattleId,
  calculated,
  defaults,
  weightKg,
  replacing: _replacing,
  onCancel,
  onSaved,
}: {
  cattleId: string;
  calculated: FeedRequirements;
  defaults: RequirementOverrideFormValues;
  weightKg: number;
  replacing: boolean;
  onCancel: () => void;
  onSaved: (warnings: RequirementOverrideWarning[]) => void;
}) {
  const t = useTranslations("cattle.feeding.requirement");
  const save = useSetRequirementOverride(cattleId);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<RequirementOverrideFormValues>({
    resolver: zodResolver(requirementOverrideFormSchema),
    defaultValues: defaults,
  });
  const typed = useWatch({ control });
  const err = (m?: string) => (m ? t(`form.error.${m}`) : undefined);

  // What is typed so far as numbers, for the derived rows and the DM hint.
  const nums = Object.fromEntries(
    Object.entries(typed).map(([k, v]) => [k, typeof v === "string" && v.trim() !== "" ? Number(v) : NaN]),
  ) as Record<EditableKey, number>;
  const dmPctOfWeight = nums.dmKg > 0 && weightKg > 0 ? (nums.dmKg / weightKg) * 100 : null;

  async function onSubmit(v: RequirementOverrideFormValues) {
    try {
      const res = await save.mutateAsync({
        dmKg: Number(v.dmKg),
        cpKg: Number(v.cpKg),
        meMj: Number(v.meMj),
        ndfKg: Number(v.ndfKg),
        ndfMaxKg: Number(v.ndfMaxKg),
        adfKg: Number(v.adfKg),
        fatKg: Number(v.fatKg),
        tdnKg: Number(v.tdnKg),
        calciumKg: Number(v.calciumKg),
        phosphorusKg: Number(v.phosphorusKg),
        rdpPct: Number(v.rdpPct),
        rupPct: Number(v.rupPct),
        ...(v.note ? { note: v.note } : {}),
      });
      toast.success(t("savedToast"));
      onSaved(res.warnings);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("genericError"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      {PROFILE_SECTIONS.map((section) => (
        <fieldset key={section.key} className="flex flex-col gap-2">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(`sections.${section.key}`)}
          </legend>

          <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
            {section.rows.map((row) => {
              const name = t(`nutrients.${row.nutrient}`);
              const c = calculated[row.reqKey] as number | null | undefined;

              if (row.kind === "derived") {
                const live = row.live(nums, calculated);
                return (
                  <div
                    key={row.nutrient}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 bg-muted/30 px-3.5 py-2.5 text-sm sm:grid-cols-[minmax(0,1.5fr)_7rem_minmax(0,1fr)_2.5rem]"
                  >
                    <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                      <span>{name}</span>
                      <span className="text-xs">({row.unit})</span>
                      <Badge
                        variant="outline"
                        className="h-4 border-border/60 bg-muted/60 px-1.5 text-xs font-normal text-muted-foreground"
                      >
                        {t("derivedBadge")}
                      </Badge>
                      <FormulaHint formulaKey={row.formulaKey} />
                    </span>
                    <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                      <span className="opacity-70">{t("col.calculated")}:</span> {fmt(c)}
                    </span>
                    <span className="text-right font-semibold tabular-nums text-foreground sm:text-left">
                      {live !== null && Number.isFinite(live) ? fmt(live) : "—"}
                    </span>
                    <span aria-hidden className="hidden sm:block" />
                  </div>
                );
              }

              const fieldError = err(errors[row.formKey]?.message);
              const changed = c != null && typed[row.formKey] !== asField(c);

              return (
                <div
                  key={row.nutrient}
                  className="flex flex-col gap-1.5 px-3.5 py-2.5 text-sm transition-colors hover:bg-muted/10 sm:grid sm:grid-cols-[minmax(0,1.5fr)_7rem_minmax(0,1fr)_2.5rem] sm:items-center sm:gap-x-3 sm:gap-y-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 sm:justify-start">
                    <label htmlFor={`req-${row.formKey}`} className="font-medium text-foreground cursor-pointer">
                      {name} <span className="text-xs font-normal text-muted-foreground">({row.unit})</span>
                    </label>
                    <span className="text-xs tabular-nums text-muted-foreground sm:hidden">
                      {t("col.calculated")}: <span className="font-medium text-foreground">{fmt(c)} {row.unit}</span>
                    </span>
                  </div>

                  <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                    <span className="opacity-70">{t("col.calculated")}:</span> {fmt(c)}
                  </span>

                  <div>
                    <Input
                      id={`req-${row.formKey}`}
                      inputMode="decimal"
                      controlSize="sm"
                      error={fieldError}
                      aria-label={`${name} (${row.unit})`}
                      className="font-mono text-sm"
                      {...register(row.formKey)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                      disabled={!changed || c == null}
                      aria-label={t("form.resetRow", { nutrient: name })}
                      title={t("form.resetRow", { nutrient: name })}
                      onClick={() => c != null && setValue(row.formKey, asField(c), { shouldDirty: true, shouldValidate: true })}
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  </div>

                  {row.formKey === "dmKg" && dmPctOfWeight !== null ? (
                    <div className="col-span-full pt-1">
                      <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                        {t("form.hintDm", { pct: fmt(dmPctOfWeight) })}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
        <LabeledInput
          label={t("form.note")}
          maxLength={300}
          placeholder="e.g. Prescribed dry-period ration"
          error={err(errors.note?.message)}
          {...register("note")}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs"
          onClick={onCancel}
          disabled={save.isPending}
        >
          <X className="size-3.5" />
          {t("form.cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          className="gap-1.5 text-xs font-semibold"
          disabled={save.isPending}
        >
          <Check className="size-3.5" />
          {save.isPending ? t("form.saving") : t("form.save")}
        </Button>
      </div>
    </form>
  );
}

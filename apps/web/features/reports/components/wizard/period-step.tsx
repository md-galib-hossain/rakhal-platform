"use client"; // preset radio + custom range picker state

import { useLocale, useTranslations } from "next-intl";
import { useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/constants/i18n";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@rakhal/ui/ui/label";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { todayLocalIso } from "@/lib/local-date";
import { DATE_PRESETS, MAX_CUSTOM_RANGE_DAYS, type DatePreset } from "../../types";
import { periodLabel } from "../../lib/format";
import { datePresetKey } from "../../lib/labels";
import { inclusiveDays } from "../../lib/ymd";
import { resolveWizardPeriod } from "./period";
import { dateToYmd, ymdToDate, type Translate, type WizardForm } from "./shared";

export function PeriodStep({ form }: { form: WizardForm }) {
  const t = useTranslations() as unknown as Translate;
  const tw = useTranslations("reportsWizard") as unknown as Translate;
  const locale = useLocale() as Locale;
  const [preset, start, end] = useWatch({ control: form.control, name: ["preset", "customStartDate", "customEndDate"] });
  const errors = form.formState.errors;
  const errorKey = errors.customStartDate?.message ?? errors.customEndDate?.message ?? errors.preset?.message;
  const today = todayLocalIso();
  const view = resolveWizardPeriod(preset, today, { startDate: start, endDate: end });
  const days = start && end ? inclusiveDays(start, end) : Number.NaN;

  function choose(next: DatePreset) {
    form.setValue("preset", next, { shouldDirty: true });
    if (next !== "custom") {
      form.setValue("customStartDate", undefined);
      form.setValue("customEndDate", undefined);
    }
    form.clearErrors(["preset", "customStartDate", "customEndDate"]);
  }

  const pickerRange = start && end ? { from: ymdToDate(start), to: ymdToDate(end) } : { from: new Date(), to: new Date() };

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        value={preset}
        onValueChange={(v) => choose(v as DatePreset)}
        aria-label={tw("period.presets")}
        className="grid-cols-2 gap-2 sm:grid-cols-5"
      >
        {DATE_PRESETS.map((p) => {
          const id = `wiz-preset-${p}`;
          const isSelected = preset === p;
          return (
            <Label
              key={p}
              htmlFor={id}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-2xl border bg-card px-3.5 py-2.5 text-sm font-medium transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                isSelected
                  ? "border-primary ring-2 ring-primary/20 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 shadow-sm"
                  : "border-border text-foreground hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <RadioGroupItem id={id} value={p} />
              {t(datePresetKey(p))}
            </Label>
          );
        })}
      </RadioGroup>

      {preset === "custom" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">{tw("period.customLabel")}</p>
          <DateRangePicker
            range={pickerRange}
            label={start && end ? periodLabel({ startDate: start, endDate: end }, locale) : tw("period.customRange")}
            options={[]}
            activeOptionId="custom"
            applyLabel={tw("period.customApply")}
            onRangeChange={(from, to) => {
              form.setValue("customStartDate", dateToYmd(from), { shouldDirty: true });
              form.setValue("customEndDate", dateToYmd(to), { shouldDirty: true });
              void form.trigger(["customStartDate", "customEndDate"]);
            }}
            className="w-full sm:w-auto"
          />
          {Number.isFinite(days) ? (
            <p className="text-xs text-muted-foreground">
              {tw("period.customDays", { count: days })} · {tw("period.customTooLong", { max: MAX_CUSTOM_RANGE_DAYS })}
            </p>
          ) : null}
        </div>
      ) : null}

      {errorKey ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {t(errorKey)}
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm" aria-live="polite">
        {view ? (
          <dl className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{tw("period.resolved")}:</dt>
              <dd className="font-medium text-foreground">{periodLabel(view.period, locale)}</dd>
            </div>
            <p className="text-muted-foreground">
              {tw(view.partial ? "period.comparedPartial" : "period.comparedWith", { period: periodLabel(view.previous, locale) })}
            </p>
            {preset === "this_week" ? <p className="text-xs text-muted-foreground">{tw("period.weekNote")}</p> : null}
          </dl>
        ) : (
          <p className="text-muted-foreground">{tw("period.pickDates")}</p>
        )}
      </div>
    </div>
  );
}

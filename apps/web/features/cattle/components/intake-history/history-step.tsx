"use client"; // controlled form state + locale-aware preview dates

import { useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { isMonthOnly, previewItems, type BreedingMethod, type HistoryValues, type YesNo } from "./history-model";

const INPUT =
  "h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

function YesNoField({ label, value, onChange }: { label: string; value: YesNo | undefined; onChange: (value: YesNo) => void }) {
  const t = useTranslations("cattle.form.history");
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex gap-2">
        {(["yes", "no"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "min-h-11 min-w-20 rounded-lg border px-4 text-sm transition-colors",
              value === option ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-foreground hover:bg-muted",
            )}
          >
            {t(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A past date the farmer may only partly remember: exact day, or "I only know the month". */
function ApproxDateField({
  label,
  value,
  onChange,
  today,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  today: string;
}) {
  const t = useTranslations("cattle.form.history");
  const id = useId();
  const [monthMode, setMonthMode] = useState(isMonthOnly(value));
  return (
    <div className="flex flex-col gap-1.5">
      {monthMode ? (
        <>
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </label>
          <input
            id={id}
            type="month"
            max={today.slice(0, 7)}
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value || undefined)}
            className={INPUT}
          />
        </>
      ) : (
        <DatePicker id={id} label={label} value={value} onChange={(next) => onChange(next || undefined)} clearable disabledDates={{ after: new Date(`${today}T00:00:00`) }} />
      )}
      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Checkbox
          checked={monthMode}
          onCheckedChange={(checked) => {
            const next = checked === true;
            setMonthMode(next);
            if (value) onChange(next ? value.slice(0, 7) : `${value.slice(0, 7)}-15`);
          }}
        />
        {t("monthOnly")}
      </label>
    </div>
  );
}

/**
 * Step 2 of Add animal (RFE-162, 03 §6): "Her history" / "His history", all optional. Fields follow the answers above
 * them (milking since only after "calved before: yes"), a month-only answer is allowed for every date, and the list at
 * the bottom shows exactly what saving will create. Nothing here is required; Skip creates nothing.
 */
export function HistoryStep({
  gender,
  values,
  onChange,
  today,
}: {
  gender: string;
  values: HistoryValues;
  onChange: (patch: Partial<HistoryValues>) => void;
  today: string;
}) {
  const t = useTranslations("cattle.form.history");
  const format = useFormatter();
  const female = gender === "FEMALE";
  const items = previewItems(values, gender, today);
  const dateLabel = (date: string | null) => (date ? format.dateTime(new Date(`${date}T00:00:00`), { dateStyle: "medium" }) : "");

  return (
    <div className="flex min-h-[460px] flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">{t(female ? "titleFemale" : "titleMale")}</h3>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {female ? (
        <>
          <YesNoField label={t("calvedBefore")} value={values.calvedBefore} onChange={(v) => onChange({ calvedBefore: v })} />
          {values.calvedBefore === "yes" ? (
            <div className="flex flex-col gap-4 border-l-2 border-border pl-4">
              <ApproxDateField label={t("lastCalving")} value={values.lastCalvingDate} onChange={(v) => onChange({ lastCalvingDate: v })} today={today} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="history-calving-number" className="text-sm font-medium text-foreground">
                  {t("calvingNumber")}
                </label>
                <input
                  id="history-calving-number"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  value={values.calvingNumber ?? ""}
                  onChange={(e) => onChange({ calvingNumber: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className={INPUT}
                />
              </div>
              <YesNoField label={t("milkingNow")} value={values.milkingNow} onChange={(v) => onChange({ milkingNow: v })} />
              {values.milkingNow === "yes" ? (
                <ApproxDateField label={t("milkingSince")} value={values.milkingSince} onChange={(v) => onChange({ milkingSince: v })} today={today} />
              ) : null}
              {values.milkingNow === "no" ? (
                <ApproxDateField label={t("drySince")} value={values.drySince} onChange={(v) => onChange({ drySince: v })} today={today} />
              ) : null}
            </div>
          ) : null}

          <YesNoField label={t("pregnant")} value={values.pregnant} onChange={(v) => onChange({ pregnant: v })} />
          {values.pregnant === "yes" ? (
            <div className="flex flex-col gap-3 border-l-2 border-border pl-4">
              <p className="text-xs text-muted-foreground">{t("pregnantHint")}</p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="history-months" className="text-sm font-medium text-foreground">
                  {t("monthsPregnant")}
                </label>
                <input
                  id="history-months"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={9.5}
                  step={0.5}
                  value={values.monthsPregnant ?? ""}
                  onChange={(e) => onChange({ monthsPregnant: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className={INPUT}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">{t("or")}</p>
              <ApproxDateField label={t("expectedCalving")} value={values.expectedCalvingDate} onChange={(v) => onChange({ expectedCalvingDate: v })} today="2100-01-01" />
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <ApproxDateField label={t("lastService")} value={values.lastBreedingDate} onChange={(v) => onChange({ lastBreedingDate: v })} today={today} />
            {values.lastBreedingDate ? (
              <div className="flex flex-col gap-3 border-l-2 border-border pl-4">
                <div role="radiogroup" aria-label={t("serviceMethod")} className="flex flex-wrap gap-2">
                  {(["AI", "NATURAL", "EMBRYO_TRANSFER"] as BreedingMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      role="radio"
                      aria-checked={(values.breedingMethod ?? "AI") === method}
                      onClick={() => onChange({ breedingMethod: method })}
                      className={cn(
                        "min-h-11 rounded-lg border px-3 text-sm",
                        (values.breedingMethod ?? "AI") === method ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border hover:bg-muted",
                      )}
                    >
                      {t(`method.${method}`)}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="history-bull" className="text-sm font-medium text-foreground">
                    {t("bull")}
                  </label>
                  <input id="history-bull" type="text" value={values.bull ?? ""} onChange={(e) => onChange({ bull: e.target.value })} className={INPUT} />
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="flex flex-col gap-4">
        <ApproxDateField label={t("lastVaccination")} value={values.lastVaccinationDate} onChange={(v) => onChange({ lastVaccinationDate: v })} today={today} />
        {values.lastVaccinationDate ? (
          <div className="flex flex-col gap-1.5 border-l-2 border-border pl-4">
            <label htmlFor="history-vaccine" className="text-sm font-medium text-foreground">
              {t("vaccineProduct")}
            </label>
            <input id="history-vaccine" type="text" value={values.vaccineProduct ?? ""} onChange={(e) => onChange({ vaccineProduct: e.target.value })} className={INPUT} />
          </div>
        ) : null}
      </div>

      <section aria-labelledby="history-preview" className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
        <h4 id="history-preview" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("previewTitle")}
        </h4>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("previewEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-foreground">
            {items.map((item) => (
              <li key={`${item.kind}-${item.date}`}>
                {t(`preview.${item.kind}`, { date: dateLabel(item.date) })}
                {item.history ? <span className="text-muted-foreground"> ({t("historyTag")})</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

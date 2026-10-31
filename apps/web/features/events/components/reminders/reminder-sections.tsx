"use client"; // controlled form sections driven by react-hook-form

import { useMemo } from "react";
import { Controller, useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayLocalIso } from "@/lib/local-date";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { CattleMultiPicker } from "@/components/shared/cattle-picker";
import { AssigneePicker } from "@/features/tasks/components/assignee-picker";
import { useTaskAssignees } from "@/features/tasks/hooks/use-tasks";
import { useAnchorEvents } from "../../reminders/use-reminders";
import {
  REMINDER_LEAD_DAYS,
  REMINDER_ROLES,
  dueFromEvent,
  type ReminderAudience,
  type ReminderFormValues,
  type ReminderRepeat,
  type ReminderWhen,
} from "../../reminders/reminder-model";

export interface SectionProps {
  control: Control<ReminderFormValues>;
  register: UseFormRegister<ReminderFormValues>;
  setValue: UseFormSetValue<ReminderFormValues>;
  errors: FieldErrors<ReminderFormValues>;
  /** Edit mode: the animals and the linked event are fixed (`PATCH /tasks/:id` cannot change them). */
  editing: boolean;
}

/** Translates a schema message (`events.reminders.errors.<key>`). */
function useFieldError(errors: FieldErrors<ReminderFormValues>) {
  const t = useTranslations("events.reminders.errors");
  return (name: keyof ReminderFormValues) => {
    const message = errors[name]?.message;
    return typeof message === "string" ? t(message as never) : undefined;
  };
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground" id={`seg-${label}`}>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={`seg-${label}`} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-11 flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors sm:min-h-10",
              value === option.value ? "border-primary bg-primary-tint text-primary" : "border-input bg-card text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Notes({ register, error }: { register: UseFormRegister<ReminderFormValues>; error?: string }) {
  const t = useTranslations("events.reminders");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="reminder-notes" className="text-xs font-medium text-foreground">
        {t("notesLabel")}
      </label>
      <textarea
        id="reminder-notes"
        rows={3}
        placeholder={t("notesPlaceholder")}
        className="w-full resize-none rounded-xl border border-input bg-card p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        {...register("notes")}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function TitleAndNotes({ register, errors }: Pick<SectionProps, "register" | "errors">) {
  const t = useTranslations("events.reminders");
  const err = useFieldError(errors);
  return (
    <>
      <LabeledInput id="reminder-title" label={t("titleLabel")} placeholder={t("titlePlaceholder")} {...register("title")} error={err("title")} />
      <Notes register={register} error={err("notes")} />
    </>
  );
}

export function WhenSection({ control, register, errors, editing }: SectionProps) {
  const t = useTranslations("events.reminders");
  const tType = useTranslations("events.timeline.type");
  const err = useFieldError(errors);
  const [when, animals, eventId, offsetDays] = useWatch({ control, name: ["when", "animals", "eventId", "offsetDays"] });
  const anchorAnimal = animals.length === 1 ? animals[0].id : undefined;
  const anchors = useAnchorEvents(anchorAnimal, when === "afterEvent");
  const picked = anchors.data?.find((e) => e.id === eventId);
  const eventLabel = (type: string) => tType(type as never);

  return (
    <div className="flex flex-col gap-3">
      {editing ? null : (
        <Controller
          control={control}
          name="when"
          render={({ field }) => (
            <Segmented<ReminderWhen>
              label={t("whenLabel")}
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "date", label: t("when.date") },
                { value: "afterEvent", label: t("when.afterEvent") },
              ]}
            />
          )}
        />
      )}

      {when === "date" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DatePicker label={t("date")} value={field.value} onChange={field.onChange} error={err("date")} disabledDates={{ before: new Date(`${todayLocalIso()}T00:00:00`) }} />
            )}
          />
          <LabeledInput id="reminder-time" type="time" label={t("time")} {...register("time")} error={err("time")} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <LabeledInput id="reminder-offset" inputMode="numeric" label={t("daysAfter")} {...register("offsetDays")} error={err("offsetDays")} />
          {editing ? (
            <p className="text-sm text-muted-foreground">
              {picked ? t("follows", { event: eventLabel(picked.type), date: dueFromEvent(picked.eventAt, 0) }) : t("followsUnknown")}
            </p>
          ) : !anchorAnimal ? (
            <p className="text-sm text-destructive">{err("animals") ?? t("pickOneAnimal")}</p>
          ) : (
            <Controller
              control={control}
              name="eventId"
              render={({ field }) => (
                <>
                  <Select value={field.value} onValueChange={field.onChange} disabled={anchors.isLoading}>
                    <LabeledSelectTrigger label={t("afterEventLabel")} placeholder={anchors.isLoading ? t("eventsLoading") : t("eventPlaceholder")} error={err("eventId")} />
                    <SelectContent>
                      {(anchors.data ?? []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {eventLabel(e.type)} · {dueFromEvent(e.eventAt, 0)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {err("eventId") ? <p className="text-xs text-destructive">{err("eventId")}</p> : null}
                </>
              )}
            />
          )}
          {anchorAnimal && !editing && !anchors.isLoading && (anchors.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{anchors.isError ? t("eventsError") : t("noEvents")}</p>
          ) : null}
          {picked && /^\d+$/.test(offsetDays) ? (
            <p className="text-sm font-medium text-foreground">{t("dueOn", { date: dueFromEvent(picked.eventAt, Number(offsetDays)) })}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function RepeatSection({ control, register, errors }: SectionProps) {
  const t = useTranslations("events.reminders");
  const err = useFieldError(errors);
  const repeat = useWatch({ control, name: "repeat" });
  return (
    <div className="flex flex-col gap-3">
      <Controller
        control={control}
        name="repeat"
        render={({ field }) => (
          <Segmented<ReminderRepeat>
            label={t("repeatLabel")}
            value={field.value}
            onChange={field.onChange}
            options={(["NEVER", "EVERY_N_DAYS", "WEEKLY", "MONTHLY"] as const).map((r) => ({ value: r, label: t(`repeat.${r}`) }))}
          />
        )}
      />
      {repeat === "EVERY_N_DAYS" ? <LabeledInput id="reminder-interval" inputMode="numeric" label={t("everyN")} {...register("intervalDays")} error={err("intervalDays")} /> : null}
      {repeat !== "NEVER" ? (
        <Controller
          control={control}
          name="endDate"
          render={({ field }) => <DatePicker label={t("endsOn")} value={field.value} onChange={field.onChange} clearable error={err("endDate")} />}
        />
      ) : null}
      <Controller
        control={control}
        name="leadDays"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <LabeledSelectTrigger label={t("leadLabel")} />
            <SelectContent>
              {REMINDER_LEAD_DAYS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {t(`lead.${d}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

function CheckRow({ id, checked, label, onChange }: { id: string; checked: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-input bg-card px-3 text-sm text-foreground">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

export function AudienceSection({ control, errors }: SectionProps) {
  const t = useTranslations("events.reminders");
  const err = useFieldError(errors);
  const audience = useWatch({ control, name: "audience" });
  const members = useTaskAssignees();
  return (
    <div className="flex flex-col gap-3">
      <Controller
        control={control}
        name="audience"
        render={({ field }) => (
          <Segmented<ReminderAudience>
            label={t("audienceLabel")}
            value={field.value}
            onChange={field.onChange}
            options={(["assignee", "roles", "people"] as const).map((a) => ({ value: a, label: t(`audience.${a}`) }))}
          />
        )}
      />
      {audience === "assignee" ? (
        <div className="flex flex-col gap-1">
          <Controller control={control} name="assigneeId" render={({ field }) => <AssigneePicker value={field.value} onValueChange={(id) => field.onChange(id)} />} />
          {err("assigneeId") ? <p className="text-xs text-destructive">{err("assigneeId")}</p> : null}
        </div>
      ) : null}
      {audience === "roles" ? (
        <Controller
          control={control}
          name="roles"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              {REMINDER_ROLES.map((role) => (
                <CheckRow
                  key={role}
                  id={`reminder-role-${role}`}
                  checked={field.value.includes(role)}
                  label={t(`roles.${role}`)}
                  onChange={(on) => field.onChange(on ? [...field.value, role] : field.value.filter((r) => r !== role))}
                />
              ))}
              {err("roles") ? <p className="text-xs text-destructive">{err("roles")}</p> : null}
            </div>
          )}
        />
      ) : null}
      {audience === "people" ? (
        <Controller
          control={control}
          name="userIds"
          render={({ field }) => (
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {members.isLoading ? <p className="text-sm text-muted-foreground">{t("peopleLoading")}</p> : null}
              {(members.data ?? []).map((m) => (
                <CheckRow
                  key={m.id}
                  id={`reminder-user-${m.id}`}
                  checked={field.value.includes(m.id)}
                  label={m.name}
                  onChange={(on) => field.onChange(on ? [...field.value, m.id] : field.value.filter((id) => id !== m.id))}
                />
              ))}
              {err("userIds") ? <p className="text-xs text-destructive">{err("userIds")}</p> : null}
            </div>
          )}
        />
      ) : null}
    </div>
  );
}

export function AnimalsSection({ control, setValue, errors, editing }: SectionProps) {
  const t = useTranslations("events.reminders");
  const err = useFieldError(errors);
  const animals = useWatch({ control, name: "animals" });
  const when = useWatch({ control, name: "when" });
  const options = useMemo(() => animals.map((a) => ({ id: a.id, tagNumber: a.tagNumber, name: a.name ?? null })), [animals]);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground">{t("animalsLabel")}</p>
      {editing ? (
        <p className="text-xs text-muted-foreground">{t("animalsLocked")}</p>
      ) : (
        <CattleMultiPicker
          value={options}
          onValueChange={(next) => {
            setValue("animals", next.map((c) => ({ id: c.id, tagNumber: c.tagNumber, name: c.name ?? null })), { shouldValidate: true });
            setValue("eventId", "");
          }}
          placeholder={when === "afterEvent" ? t("pickOneAnimal") : t("animalsPlaceholder")}
        />
      )}
      {animals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("animalsNone")}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {animals.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-bold text-foreground">
              {a.tagNumber}
              {a.name ? ` — ${a.name}` : ""}
              {editing ? null : (
                <button
                  type="button"
                  aria-label={t("removeAnimal", { animal: a.tagNumber })}
                  onClick={() => {
                    setValue("animals", animals.filter((x) => x.id !== a.id), { shouldValidate: true });
                    setValue("eventId", "");
                  }}
                  className="text-muted-foreground transition-opacity hover:opacity-70"
                >
                  <X className="size-3" aria-hidden />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {err("animals") && when === "date" ? <p className="text-xs text-destructive">{err("animals")}</p> : null}
    </div>
  );
}

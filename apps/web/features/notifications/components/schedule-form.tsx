"use client"; // react-hook-form state, debounced preview, mutations

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/use-session";
import { useCan } from "@/lib/auth/permissions";
import { todayLocalIso } from "@/lib/local-date";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@rakhal/ui/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { LabeledInput } from "@/components/ui/labeled-field";
import { CattleMultiPicker } from "@/components/shared/cattle-picker";
import { useTaskAssignees } from "@/features/tasks/hooks/use-tasks";
import { useCreateSchedule, usePreviewSchedule, useUpdateSchedule } from "../hooks/use-schedules";
import {
  COMPOSER_ROLES,
  allowedAudiences,
  anchorFromSchedule,
  buildScheduleRequest,
  buildUpdateRequest,
  composerSchema,
  defaultComposerValues,
  leadOptions,
  leadsForAllDay,
  mapServerFieldErrors,
  toggleLead,
  valuesFromSchedule,
  type ComposerAnchor,
  type ComposerAnimal,
  type ComposerAudience,
  type ComposerValues,
  type ComposerWhen,
} from "../schedule-model";
import type { NotificationSchedule, UpdateScheduleInput } from "../types";

export interface ScheduleFormProps {
  /** Edit mode: the saved schedule (F03 passes it through `NewTab editingId`). */
  schedule?: NotificationSchedule;
  /** Create mode: what the notice is relative to (animal event / task / health step) — F06 "Remind me" entry points. */
  anchor?: ComposerAnchor | null;
  /** Create mode: pre-picked animal. */
  animal?: ComposerAnimal;
  /** Called after a successful create / save. */
  onDone?: () => void;
  /** Edit mode: leave without saving. */
  onCancel?: () => void;
}

function Segmented<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground" id={id}>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-11 flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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

function CheckRow({ id, checked, label, onChange }: { id: string; checked: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-input bg-card px-3 text-sm text-foreground">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

/** Composer (create + edit). Farm-local strings only: the live preview comes from the server, never from browser time math. */
export function ScheduleForm({ schedule, anchor: anchorProp, animal, onDone, onCancel }: ScheduleFormProps) {
  const t = useTranslations("notificationSheet.compose");
  const tErr = useTranslations("notificationSheet.compose.errors");
  const format = useFormatter();
  const { data: session } = useSession();
  const can = useCan();
  const canManage = can("notification.manage");
  const meId = session?.user.id ?? "";
  const editing = Boolean(schedule);
  const anchor = useMemo(() => (schedule ? anchorFromSchedule(schedule) : (anchorProp ?? null)), [schedule, anchorProp]);

  const create = useCreateSchedule();
  const update = useUpdateSchedule();
  const preview = usePreviewSchedule();
  const members = useTaskAssignees();

  const form = useForm<ComposerValues>({
    resolver: zodResolver(composerSchema),
    defaultValues: schedule ? valuesFromSchedule(schedule, meId) : defaultComposerValues({ today: todayLocalIso(), anchor, animal }),
  });
  const { control, register, setValue, setError, formState } = form;
  const { errors } = formState;
  const values = useWatch({ control }) as ComposerValues;
  const err = (name: keyof ComposerValues) => {
    const m = errors[name]?.message;
    if (typeof m !== "string") return undefined;
    return /^[a-zA-Z]+$/.test(m) ? tErr(m as never) : m;
  };

  // Live preview: debounced, only for a valid draft; the key changes only when the request content does.
  const request = useMemo(() => {
    const parsed = composerSchema.safeParse(values);
    if (!parsed.success || !meId) return null;
    return buildScheduleRequest(parsed.data, { meId, canManage, anchor });
  }, [values, meId, canManage, anchor]);
  const requestKey = request ? JSON.stringify(request) : "";
  const { mutate: runPreview, reset: resetPreview } = preview;
  useEffect(() => {
    if (!requestKey) {
      resetPreview();
      return;
    }
    const timer = setTimeout(() => runPreview(JSON.parse(requestKey)), 500);
    return () => clearTimeout(timer);
  }, [requestKey, runPreview, resetPreview]);

  const pending = create.isPending || update.isPending;
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  async function onSubmit(v: ComposerValues) {
    setServerMessage(null);
    try {
      if (schedule) {
        await update.mutateAsync({ id: schedule.id, input: buildUpdateRequest(v, { meId, canManage, anchor }) as unknown as UpdateScheduleInput });
        toast.success(t("updatedToast"));
      } else {
        await create.mutateAsync(buildScheduleRequest(v, { meId, canManage, anchor }));
        toast.success(t("createdToast"));
      }
      onDone?.();
    } catch (e) {
      if (e instanceof ApiError) {
        const fields = mapServerFieldErrors(e.details);
        fields.forEach((f) => setError(f.field, { type: "server", message: f.message }));
        if (fields.length === 0) setServerMessage(e.message);
      } else {
        setServerMessage(t("genericError"));
      }
    }
  }

  const when = values.when;
  const allDay = values.allDay;
  const audiences = allowedAudiences(canManage);
  const whenOptions: { value: ComposerWhen; label: string }[] = anchor
    ? [
        { value: "before", label: t("when.before") },
        { value: "after", label: t("when.after") },
        { value: "date", label: t("when.date") },
      ]
    : [{ value: "date", label: t("when.date") }];

  // The server returns farm-local `YYYY-MM-DDTHH:mm`; build the Date from its parts (no timezone conversion).
  const fmtLocal = (local: string) => {
    const [d, tm] = local.split("T");
    const [y, mo, da] = d.split("-").map(Number);
    const [h, mi] = (tm ?? "00:00").split(":").map(Number);
    return format.dateTime(new Date(y, mo - 1, da, h, mi), { dateStyle: "medium", timeStyle: "short" });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5 pt-3">
      <LabeledInput id="compose-title" label={t("titleLabel")} placeholder={t("titlePlaceholder")} maxLength={120} {...register("title")} error={err("title")} />
      <div className="flex flex-col gap-1">
        <label htmlFor="compose-notes" className="text-xs font-medium text-foreground">
          {t("notesLabel")}
        </label>
        <textarea
          id="compose-notes"
          rows={3}
          placeholder={t("notesPlaceholder")}
          className="w-full resize-none rounded-xl border border-input bg-card p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          {...register("notes")}
        />
        {err("notes") ? <p className="text-xs text-destructive">{err("notes")}</p> : null}
      </div>

      {/* WHEN */}
      <div className="flex flex-col gap-3">
        {anchor ? (
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
            {anchor.label ? t("anchorAbout", { label: anchor.label }) : t("anchorLinked")}
          </p>
        ) : null}
        {whenOptions.length > 1 ? (
          <Controller
            control={control}
            name="when"
            render={({ field }) => <Segmented id="compose-when" label={t("whenLabel")} value={field.value} options={whenOptions} onChange={field.onChange} />}
          />
        ) : null}
        {when === "date" ? (
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DatePicker label={t("dateLabel")} value={field.value} onChange={field.onChange} error={err("date")} disabledDates={{ before: new Date(`${todayLocalIso()}T00:00:00`) }} />
            )}
          />
        ) : (
          <LabeledInput
            id="compose-offset"
            inputMode="numeric"
            label={when === "before" ? t("daysBefore") : t("daysAfter")}
            {...register("offsetDays")}
            error={err("offsetDays")}
          />
        )}
        <Controller
          control={control}
          name="allDay"
          render={({ field }) => (
            <Segmented
              id="compose-timemode"
              label={t("timeModeLabel")}
              value={field.value ? "allDay" : "at"}
              options={[
                { value: "at", label: t("timeMode.at") },
                { value: "allDay", label: t("timeMode.allDay") },
              ]}
              onChange={(next) => {
                const nextAllDay = next === "allDay";
                field.onChange(nextAllDay);
                setValue("leads", leadsForAllDay(values.leads, nextAllDay), { shouldValidate: formState.isSubmitted });
              }}
            />
          )}
        />
        {allDay ? (
          <p className="text-sm text-muted-foreground">{t("allDayHint")}</p>
        ) : (
          <LabeledInput id="compose-time" type="time" label={t("timeLabel")} {...register("time")} error={err("time")} />
        )}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-foreground" id="compose-lead">
            {t("leadLabel")}
          </p>
          <div role="group" aria-labelledby="compose-lead" className="flex flex-wrap gap-2">
            {leadOptions(allDay).map((m) => {
              const on = values.leads.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setValue("leads", toggleLead(values.leads, m), { shouldValidate: true })}
                  className={cn(
                    "min-h-11 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    on ? "border-primary bg-primary-tint text-primary" : "border-input bg-card text-foreground",
                  )}
                >
                  {t(`lead.${m}` as never)}
                </button>
              );
            })}
          </div>
          {err("leads") ? <p className="text-xs text-destructive">{err("leads")}</p> : null}
        </div>
      </div>

      {/* REPEAT */}
      <div className="flex flex-col gap-3">
        <Controller
          control={control}
          name="repeat"
          render={({ field }) => (
            <Segmented
              id="compose-repeat"
              label={t("repeatLabel")}
              value={field.value}
              onChange={field.onChange}
              options={(["NEVER", "EVERY_N_DAYS", "WEEKLY", "MONTHLY"] as const).map((r) => ({ value: r, label: t(`repeat.${r}`) }))}
            />
          )}
        />
        {values.repeat === "EVERY_N_DAYS" ? (
          <LabeledInput id="compose-interval" inputMode="numeric" label={t("everyN")} {...register("intervalDays")} error={err("intervalDays")} />
        ) : null}
        {values.repeat !== "NEVER" ? (
          <Controller
            control={control}
            name="endDate"
            render={({ field }) => <DatePicker label={t("endsOn")} value={field.value} onChange={field.onChange} clearable error={err("endDate")} />}
          />
        ) : null}
      </div>

      {/* AUDIENCE */}
      <div className="flex flex-col gap-3">
        {audiences.length > 1 ? (
          <Controller
            control={control}
            name="audience"
            render={({ field }) => (
              <Segmented<ComposerAudience>
                id="compose-audience"
                label={t("audienceLabel")}
                value={field.value}
                onChange={field.onChange}
                options={audiences.map((a) => ({ value: a, label: t(`audience.${a}`) }))}
              />
            )}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("onlyYou")}</p>
        )}
        {canManage && values.audience === "roles" ? (
          <Controller
            control={control}
            name="roles"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                {COMPOSER_ROLES.map((role) => (
                  <CheckRow
                    key={role}
                    id={`compose-role-${role}`}
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
        {canManage && values.audience === "people" ? (
          <Controller
            control={control}
            name="userIds"
            render={({ field }) => (
              <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                {members.isLoading ? <p className="text-sm text-muted-foreground">{t("peopleLoading")}</p> : null}
                {members.isError ? <p className="text-sm text-destructive">{t("peopleError")}</p> : null}
                {!members.isLoading && !members.isError && (members.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("peopleEmpty")}</p>
                ) : null}
                {(members.data ?? []).map((m) => (
                  <CheckRow
                    key={m.id}
                    id={`compose-user-${m.id}`}
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

      {/* ANIMALS */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-foreground">{t("animalsLabel")}</p>
        <CattleMultiPicker
          value={values.animals.filter((a) => a.tagNumber).map((a) => ({ id: a.id, tagNumber: a.tagNumber, name: a.name ?? null }))}
          onValueChange={(next) => setValue("animals", next.map((c) => ({ id: c.id, tagNumber: c.tagNumber, name: c.name ?? null })), { shouldValidate: true })}
          placeholder={t("animalsPlaceholder")}
        />
        {values.animals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("animalsNone")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {values.animals.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-bold text-foreground">
                {a.tagNumber ? `${a.tagNumber}${a.name ? ` — ${a.name}` : ""}` : t("animalChip")}
                <button
                  type="button"
                  aria-label={t("removeAnimal", { animal: a.tagNumber || t("animalChip") })}
                  onClick={() => setValue("animals", values.animals.filter((x) => x.id !== a.id), { shouldValidate: true })}
                  className="flex size-6 items-center justify-center text-muted-foreground transition-opacity hover:opacity-70"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
        {err("animals") ? <p className="text-xs text-destructive">{err("animals")}</p> : null}
      </div>

      {/* PREVIEW (server-computed, farm-local) */}
      <section aria-live="polite" className="rounded-xl border border-border bg-muted p-3 text-sm text-foreground">
        <p className="text-xs font-semibold text-muted-foreground">{t("preview.title")}</p>
        {!request ? (
          <p className="mt-1 text-muted-foreground">{t("preview.idle")}</p>
        ) : preview.isError ? (
          <p className="mt-1 text-destructive">{preview.error instanceof ApiError ? preview.error.message : t("preview.error")}</p>
        ) : preview.data ? (
          preview.data.next_fire_times.length === 0 ? (
            <p className="mt-1 text-muted-foreground">{t("preview.none")}</p>
          ) : (
            <div className="mt-1 flex flex-col gap-1">
              <ul className="flex flex-col gap-0.5">
                {preview.data.next_fire_times.map((f) => (
                  <li key={`${f.fire_at}-${f.lead_minutes}`} className="font-medium">
                    {fmtLocal(f.local)}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {t("preview.recipients", { count: preview.data.recipient_count })} · {preview.data.timezone}
              </p>
            </div>
          )
        ) : (
          <p className="mt-1 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t("preview.loading")}
          </p>
        )}
      </section>

      {serverMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {serverMessage}
        </p>
      ) : null}

      <div className="flex gap-2 pb-2">
        {editing && onCancel ? (
          <Button type="button" variant="secondary" className="h-12 flex-1 rounded-xl" onClick={onCancel} disabled={pending}>
            {t("cancel")}
          </Button>
        ) : null}
        <Button type="submit" className="h-12 flex-1 rounded-xl" disabled={pending || !meId}>
          {pending ? t("saving") : editing ? t("save") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

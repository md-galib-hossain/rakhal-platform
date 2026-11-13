"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, isValid, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock, RotateCcw, X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { CattleMultiPicker, type CattleOption } from "@/components/shared/cattle-picker";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { Label } from "@rakhal/ui/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@rakhal/ui/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useApplyProtocol, useProtocol, useProtocolInstance, useProtocols } from "../../hooks/use-reproduction";
import { applyProtocolSchema, type ApplyProtocolInput } from "../../schemas";
import { ProtocolDetailSheet } from "./protocol-detail-sheet";
import { ProtocolInstanceTimeline } from "./protocol-instance-timeline";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function computeStepDateTime(startStr?: string, dayNumber = 0): string {
  if (!startStr) return "";
  const start = parseISO(startStr);
  if (!isValid(start)) return "";
  const d = addDays(start, dayNumber);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function getDefaultStartDateTime(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

/** "Apply Protocol" (RAKHAL-214, PRD §9.8) — allows applying a protocol with both date and time,
 * displaying step-by-step dates & times inline with full per-step override support. */
export function ApplyProtocolDialog({
  open,
  onOpenChange,
  defaultCattleId,
  defaultProtocolId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCattleId?: string;
  /** Preselects the protocol — the per-card "Apply" shortcut in the library skips the picker step. */
  defaultProtocolId?: string;
}) {
  const t = useTranslations("reproduction.dialogs.applyProtocol");
  const protocols = useProtocols();
  const applyProtocol = useApplyProtocol();
  const [selectedCattle, setSelectedCattle] = useState<CattleOption[]>([]);
  const [appliedInstanceId, setAppliedInstanceId] = useState<string | null>(null);
  const appliedInstance = useProtocolInstance(appliedInstanceId ?? undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProtocolId, setSelectedProtocolId] = useState("");
  const [selectedStartDate, setSelectedStartDate] = useState(getDefaultStartDateTime());
  const [stepOverrides, setStepOverrides] = useState<Record<number, string>>({});

  const protocolDetail = useProtocol(selectedProtocolId || undefined);
  const protocolOptions = useMemo(() => protocols.data?.pages.flatMap((p) => p.items) ?? [], [protocols.data]);

  const form = useForm<ApplyProtocolInput>({
    resolver: zodResolver(applyProtocolSchema),
    defaultValues: {
      protocolId: "",
      cattleIds: defaultCattleId ? [defaultCattleId] : [],
      startDate: getDefaultStartDateTime(),
    },
  });

  // Reset when the dialog transitions closed→open
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const defaultStart = getDefaultStartDateTime();
      form.reset({
        protocolId: defaultProtocolId ?? "",
        cattleIds: defaultCattleId ? [defaultCattleId] : [],
        startDate: defaultStart,
      });
      setSelectedCattle([]);
      setSelectedProtocolId(defaultProtocolId ?? "");
      setSelectedStartDate(defaultStart);
      setStepOverrides({});
    }
  }

  function updateSelectedCattle(next: CattleOption[]) {
    setSelectedCattle(next);
    form.setValue(
      "cattleIds",
      next.map((c) => c.id),
      { shouldValidate: true },
    );
  }

  function removeCattle(id: string) {
    updateSelectedCattle(selectedCattle.filter((c) => c.id !== id));
  }

  function handleStepOverride(dayNumber: number, val: string) {
    setStepOverrides((prev) => ({
      ...prev,
      [dayNumber]: val,
    }));
  }

  function handleResetStep(dayNumber: number) {
    setStepOverrides((prev) => {
      const next = { ...prev };
      delete next[dayNumber];
      return next;
    });
  }

  async function onSubmit(values: ApplyProtocolInput) {
    try {
      const overridesList = Object.entries(stepOverrides).map(([dayStr, dueAt]) => ({
        dayNumber: Number(dayStr),
        dueAt,
      }));

      const result = await applyProtocol.mutateAsync({
        ...values,
        startDate: values.startDate || undefined,
        stepOverrides: overridesList.length > 0 ? overridesList : undefined,
      });
      toast.success(t("appliedToast", { count: result.applied }));
      onOpenChange(false);
      setAppliedInstanceId(result.instance_ids[0] ?? null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) form.reset();
          onOpenChange(next);
        }}
        title={t("title")}
        onSubmit={form.handleSubmit(onSubmit)}
        pending={applyProtocol.isPending}
        submitLabel={t("submit")}
      >
        <div className="flex flex-col gap-2">
          <Label>{t("protocol")}</Label>
          <Controller
            control={form.control}
            name="protocolId"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedProtocolId(value);
                    setStepOverrides({});
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("protocolPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {protocolOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({t("stepCount", { count: p.step_count })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!field.value}
                  onClick={() => setDetailOpen(true)}
                >
                  {t("viewDetails")}
                </Button>
              </div>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("cattle")}</Label>
          <CattleMultiPicker
            value={selectedCattle}
            onValueChange={updateSelectedCattle}
            placeholder={t("cattlePlaceholder")}
            filters={{ gender: "FEMALE", reproductiveStatus: "OPEN" }}
          />
          {selectedCattle.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedCattle.map((c) => (
                <span
                  key={c.id}
                  className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-foreground"
                >
                  {c.tagNumber}
                  {c.name ? ` — ${c.name}` : ""}
                  <button type="button" onClick={() => removeCattle(c.id)} aria-label={t("removeCow")}>
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {form.formState.errors.cattleIds ? (
            <p className="text-xs text-destructive">{form.formState.errors.cattleIds.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("startDate")}</Label>
          <Controller
            control={form.control}
            name="startDate"
            render={({ field, fieldState }) => (
              <DateTimePicker
                label={t("startDate")}
                value={field.value}
                onChange={(next) => {
                  field.onChange(next);
                  setSelectedStartDate(next);
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>

        {selectedProtocolId ? (
          <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CalendarClock className="size-4 text-primary" aria-hidden />
                <span className="text-xs font-semibold text-foreground">{t("scheduleTitle")}</span>
              </div>
              {protocolDetail.data ? (
                <span className="text-xs text-muted-foreground">
                  {t("stepCount", { count: protocolDetail.data.steps.length })}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{t("scheduleDescription")}</p>

            {protocolDetail.isLoading ? (
              <CardSkeleton lines={3} />
            ) : protocolDetail.data && protocolDetail.data.steps.length > 0 ? (
              <div className="flex flex-col gap-2.5 pt-1">
                {[...protocolDetail.data.steps]
                  .sort((a, b) => a.day_number - b.day_number)
                  .map((step) => {
                    const defaultDueAt = computeStepDateTime(selectedStartDate, step.day_number);
                    const isOverridden = stepOverrides[step.day_number] !== undefined;
                    const currentDueAt = isOverridden ? stepOverrides[step.day_number] : defaultDueAt;

                    return (
                      <div
                        key={`${step.day_number}-${step.title}`}
                        className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {step.day_number}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{step.title}</p>
                              {step.instruction ? (
                                <p className="text-xs text-muted-foreground line-clamp-1">{step.instruction}</p>
                              ) : null}
                            </div>
                          </div>
                          {isOverridden ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="rounded-full bg-warning-tint px-2 py-0.5 text-xs font-medium text-warning">
                                {t("customized")}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => handleResetStep(step.day_number)}
                                title={t("resetStep")}
                              >
                                <RotateCcw className="size-3" aria-hidden />
                                <span className="sr-only">{t("resetStep")}</span>
                              </Button>
                            </div>
                          ) : null}
                        </div>
                        <div className="pt-0.5">
                          <DateTimePicker
                            label={`${step.title} schedule`}
                            value={currentDueAt}
                            onChange={(val) => handleStepOverride(step.day_number, val)}
                            minuteStep={5}
                            className="h-8.5 text-xs"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : null}
          </div>
        ) : null}
      </FormSheet>

      <ProtocolInstanceTimeline
        instance={appliedInstance.data ?? null}
        open={appliedInstanceId !== null && Boolean(appliedInstance.data)}
        onOpenChange={(next) => {
          if (!next) setAppliedInstanceId(null);
        }}
      />
      <ProtocolDetailSheet
        protocol={protocolOptions.find((p) => p.id === selectedProtocolId) ?? null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        startDate={selectedStartDate}
      />
    </>
  );
}

"use client"; // form state, debounced dry run, mutations

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { todayLocalIso } from "@/lib/local-date";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { CattleDetail } from "@/features/cattle/types";
import { EVENT_VOID_AVAILABLE } from "../../api";
import { buildRequest, defaultValues, FORM_DEFS, validateValues, type FieldError } from "../../forms/definitions";
import { clientFindings, findingMessageKey, isPastRecord, previewFollowUps } from "../../forms/followups";
import type { Finding, FollowUpPreview, FormDef, FormValues } from "../../forms/types";
import { EventUnavailableError, extractRef, useEventDryRun, useRecordEvent, useVoidEvent } from "../../hooks/use-record-event";
import type { EventKey } from "../../types";
import { FieldRenderer } from "./field-renderer";
import { WhatHappensNext } from "./what-happens-next";
import { WhenField } from "./when-field";

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(handle);
  }, [value, ms]);
  return debounced;
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function newKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * The shared event form (RFE-158/159, 03 §5): docked over the right column at >=1024px, a full-screen layer below.
 * When (Today / Yesterday / Pick date + time) -> required fields -> "More details" (collapsed) -> amber findings that
 * never block saving -> "What happens next" with per-item toggles (follow-ups already past due start off) -> Save and
 * Save & record another. A date more than 7 days back pre-ticks "This is a past record" (HISTORICAL). Saves through
 * `POST /cattle/:id/events` with an Idempotency-Key; while that route is missing, a few events use their old endpoint
 * (`forms/fallback.ts`) and the rest say they are not available yet.
 */
export function EventFormPanel({
  eventKey,
  cattle,
  onBack,
  onDone,
}: {
  eventKey: EventKey;
  cattle: CattleDetail;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("events.form");
  const tCatalogue = useTranslations("events.catalogue");
  const tFinding = useTranslations("events.form.finding");
  const tChip = useTranslations("events.chip");
  const def = FORM_DEFS[eventKey] as FormDef;
  const today = todayLocalIso();

  const [values, setValues] = useState<FormValues>(() => defaultValues(def));
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(nowTime);
  const [pastOverride, setPastOverride] = useState<boolean | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [unsupportedAtSave, setUnsupportedAtSave] = useState(false);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const past = isPastRecord(date, today);
  const historical = pastOverride ?? past;
  const record = useRecordEvent(cattle.id, eventKey);
  const voidEvent = useVoidEvent(cattle.id);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const liveErrors = useMemo(() => validateValues(def, values, { historical }), [def, values, historical]);
  const dryRequest = useMemo(
    () => (Object.keys(liveErrors).length === 0 && date <= today ? buildRequest(def, values, { date, time, historical }) : null),
    [def, values, date, time, historical, liveErrors, today],
  );
  const debouncedRequest = useDebounced(dryRequest, 350);
  const dry = useEventDryRun({
    cattleId: cattle.id,
    eventKey,
    facts: cattle,
    values,
    date,
    today,
    request: debouncedRequest,
    enabled: debouncedRequest !== null,
  });

  // Instant client-side answers while (or instead of) the server dry run, so the block never flickers empty.
  const findings: Finding[] = dry.data?.findings ?? clientFindings(eventKey, cattle, date, today);
  const followUps: FollowUpPreview[] = dry.data?.followUps ?? previewFollowUps(eventKey, values, date, today);
  const defaultOn = (item: FollowUpPreview) => item.defaultOn ?? !item.pastDue;
  const isOn = (item: FollowUpPreview) => toggles[item.key] ?? defaultOn(item);
  // The server has no handler for this event type yet (422 EVENT_TYPE_NOT_SUPPORTED): say so instead of showing a dead form.
  const dryUnsupported = dry.error instanceof ApiError && dry.error.details?.eventCode === "EVENT_TYPE_NOT_SUPPORTED";
  const unsupported = unsupportedAtSave || dryUnsupported;
  const dryError =
    dry.error instanceof ApiError && (dry.error.status === 400 || dry.error.status === 422) && !dryUnsupported ? dry.error.message : null;
  const blocked = findings.some((f) => f.severity === "BLOCK") || Boolean(dryError);

  function findingText(finding: Finding): string {
    if (finding.code === "UNUSUAL_FOR_STATE") return tFinding("UNUSUAL_FOR_STATE", { chips: (finding.chips ?? []).map((c) => tChip(c as never)).join(", ") });
    // Unknown codes become a generic sentence for their severity; a raw code or the server's English never reaches the screen.
    return tFinding(findingMessageKey(finding) as never);
  }

  function setValue(name: string, value: FormValues[string]) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => {
      if (!previous[name]) return previous;
      const next = { ...previous };
      delete next[name];
      return next;
    });
    setServerError(null);
  }

  function errorMessage(error: unknown): string {
    if (error instanceof EventUnavailableError) return t("unavailable");
    if (error instanceof ApiError) {
      if (error.details?.eventCode === "EVENT_TYPE_NOT_SUPPORTED") return t("unavailable");
      return error.isForbidden ? t("forbidden") : error.message;
    }
    return t("genericError");
  }

  async function undo(ref: string) {
    try {
      await voidEvent.mutateAsync({ ref, reason: "Undone right after saving" });
      toast.success(t("undone"));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function submit(another: boolean) {
    const found = validateValues(def, values, { historical });
    setErrors(found);
    if (Object.keys(found).length > 0 || date > today || blocked) return;
    const request = buildRequest(def, values, { date, time, historical });
    // Send the switches only when the user changed one and the preview came from the server (its rule keys are the ones it
    // understands); a server that does not take the field yet is retried without it in `useRecordEvent`.
    if (dry.data?.source === "route" && followUps.some((item) => isOn(item) !== defaultOn(item))) {
      request.followUps = followUps.map((item) => ({ ruleKey: item.key, enabled: isOn(item) }));
    }
    try {
      const result = await record.mutateAsync({ request, idempotencyKey });
      const ref = result.via === "route" ? extractRef(result.body) : null;
      const message = t("saved", { event: tCatalogue(`${eventKey}.label`), count: followUps.filter(isOn).length });
      if (ref && EVENT_VOID_AVAILABLE) toast.success(message, { duration: 5000, action: { label: t("undo"), onClick: () => void undo(ref) } });
      else toast.success(message);
      if (another) {
        setValues(defaultValues(def));
        setErrors({});
        setToggles({});
        setServerError(null);
        setIdempotencyKey(newKey());
        titleRef.current?.focus();
      } else {
        onDone();
      }
    } catch (error) {
      if (error instanceof EventUnavailableError || (error instanceof ApiError && error.details?.eventCode === "EVENT_TYPE_NOT_SUPPORTED")) {
        setUnsupportedAtSave(true);
      } else {
        setServerError(errorMessage(error));
      }
    }
  }

  const required = def.fields.filter((f) => !f.detail);
  const details = def.fields.filter((f) => f.detail);
  const title = `${tCatalogue(`${eventKey}.label`)} · ${cattle.name ?? cattle.tagNumber}`;
  const oneOfNote = def.requireOneOf ? t("requireOneOf") : null;

  if (unsupported) {
    return (
      <section
        aria-labelledby="event-form-title"
        className="fixed inset-0 z-[60] flex flex-col bg-card lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[460px] lg:rounded-r-[18px] lg:border-l lg:border-border lg:shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Button type="button" variant="ghost" size="icon" aria-label={t("back")} onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <h3 id="event-form-title" ref={titleRef} tabIndex={-1} className="min-w-0 flex-1 truncate text-base font-semibold text-foreground outline-none">
            {title}
          </h3>
        </div>
        <div role="status" className="flex flex-col gap-4 p-4">
          <p className="text-base font-semibold text-foreground">{t("unsupportedTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("unsupportedBody")}</p>
          {def.fallbackHref ? (
            <Link href={def.fallbackHref} className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
              {t("openHealthcare")}
            </Link>
          ) : null}
          <Button type="button" variant="outline" className="h-12" onClick={onBack}>
            {t("back")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="event-form-title"
      className="fixed inset-0 z-[60] flex flex-col bg-card lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[460px] lg:rounded-r-[18px] lg:border-l lg:border-border lg:shadow-xl"
    >
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Button type="button" variant="ghost" size="icon" aria-label={t("back")} onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <h3 id="event-form-title" ref={titleRef} tabIndex={-1} className="min-w-0 flex-1 truncate text-base font-semibold text-foreground outline-none">
          {title}
        </h3>
      </div>

      {/* Ctrl/Cmd+Enter = Save & record another (03 §10); Enter alone submits natively. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit(true);
          }
        }}
        noValidate
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <WhenField date={date} time={time} showTime={Boolean(def.showTime)} today={today} onDateChange={setDate} onTimeChange={setTime} />

          {required.map((field) => (
            <FieldRenderer key={field.name} field={field} value={values[field.name]} onChange={(v) => setValue(field.name, v)} error={errors[field.name]} today={today} />
          ))}
          {oneOfNote ? <p className="-mt-2 text-xs text-muted-foreground">{oneOfNote}</p> : null}

          {past ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
              <Checkbox checked={historical} onCheckedChange={(checked) => setPastOverride(checked === true)} />
              {t("pastRecord")}
            </label>
          ) : null}

          {details.length > 0 ? (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                aria-expanded={showDetails}
                onClick={() => setShowDetails((open) => !open)}
                className="flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary"
              >
                <ChevronDown className={cn("size-4 transition-transform", showDetails && "rotate-180")} aria-hidden />
                {showDetails ? t("lessDetails") : t("moreDetails")}
              </button>
              {showDetails
                ? details.map((field) => (
                    <FieldRenderer key={field.name} field={field} value={values[field.name]} onChange={(v) => setValue(field.name, v)} error={errors[field.name]} today={today} />
                  ))
                : null}
            </div>
          ) : null}

          {findings.length > 0 ? (
            <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
              {findings.map((finding) => (
                <p
                  key={`${finding.code}-${finding.severity}`}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-sm",
                    finding.severity === "BLOCK" ? "border-destructive/40 bg-destructive-tint text-destructive" : "border-warning/40 bg-warning-tint text-warning",
                  )}
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {findingText(finding)}
                    {finding.severity === "WARN" ? ` ${t("saveAnyway")}` : null}
                  </span>
                </p>
              ))}
            </div>
          ) : null}
          {dryError ? <p className="text-sm text-destructive">{dryError}</p> : null}

          <WhatHappensNext
            items={followUps}
            isOn={isOn}
            onToggle={(item, on) => setToggles((previous) => ({ ...previous, [item.key]: on }))}
          />
          {serverError ? (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row-reverse">
          <Button type="submit" className="h-12 w-full sm:w-auto sm:flex-1" disabled={record.isPending || blocked}>
            {record.isPending ? t("saving") : t("save")}
          </Button>
          <Button type="button" variant="outline" className="h-12 w-full sm:w-auto sm:flex-1" disabled={record.isPending || blocked} onClick={() => void submit(true)}>
            {t("saveAnother")}
          </Button>
        </div>
      </form>
    </section>
  );
}

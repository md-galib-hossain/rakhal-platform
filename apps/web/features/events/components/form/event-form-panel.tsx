"use client"; // form state, debounced dry run, mutations

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { todayLocalIso } from "@/lib/local-date";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@rakhal/ui/ui/checkbox";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { CattleDetail } from "@/features/cattle/types";
import { buildRequest, defaultValues, FORM_DEFS, validateValues, type FieldError } from "../../forms/definitions";
import { clientFindings, findingMessageKey, isPastRecord, previewFollowUps } from "../../forms/followups";
import type { Finding, FollowUpPreview, FormDef, FormValues } from "../../forms/types";
import { EventUnavailableError, extractRef, useEventDryRun, useRecordEvent, useVoidEvent } from "../../hooks/use-record-event";
import type { EventKey } from "../../types";
import { EventContextCard } from "./event-context-card";
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
 * The shared event form (RFE-158/159, 03 §5; RFE-179, 06 §7): a 600px right drawer (a nested Sheet, so it has a focus
 * trap, `aria-modal`, Esc and a backdrop over the whole workspace), full screen below 640px. Top to bottom: cow strip ->
 * When (Today / Yesterday / Pick date + time) -> required fields -> "More details" (collapsed) -> "What happens next" with
 * per-item toggles (follow-ups already past due start off) -> a sticky footer holding the amber findings (they never block
 * saving) and Save / Save & record another. A date more than 7 days back pre-ticks "This is a past record" (HISTORICAL).
 * Esc, the backdrop and X ask before throwing away typed values. Saves through `POST /cattle/:id/events` with an
 * Idempotency-Key; while that route is missing, a few events use their old endpoint (`forms/fallback.ts`) and the rest say
 * they are not available yet.
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
  // Which way the user was leaving when the unsaved-changes question came up.
  const [confirmExit, setConfirmExit] = useState<"done" | "back" | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const keepEditingRef = useRef<HTMLDivElement>(null);
  const [pristine] = useState(() => JSON.stringify(defaultValues(def)));

  const past = isPastRecord(date, today);
  const historical = pastOverride ?? past;
  const record = useRecordEvent(cattle.id);
  const voidEvent = useVoidEvent(cattle.id);
  const dirty = JSON.stringify(values) !== pristine || date !== today || pastOverride !== null || Object.keys(toggles).length > 0;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (confirmExit) keepEditingRef.current?.querySelector("button")?.focus();
  }, [confirmExit]);

  // The dry run is what tells us a Treatment will open a new case (finding TREATMENT_NEW_CASE), and only then is the
  // Condition field shown - so the dry run itself must not wait for that field: it is gated on the other fields alone.
  // Kept in state so the field does not blink away while the next dry run is in flight.
  const [needsCondition, setNeedsCondition] = useState(false);  const liveErrors = useMemo(() => validateValues(def, values, { historical }), [def, values, historical]);
  const dryRequest = useMemo(
    () => (Object.keys(liveErrors).length === 0 && date <= today ? buildRequest(def, values, { date, time, historical, needsCondition }) : null),
    [def, values, date, time, historical, liveErrors, today, needsCondition],
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
  const dryNeedsCondition = dry.data ? dry.data.findings.some((f) => f.code === "TREATMENT_NEW_CASE") : undefined;
  if (eventKey === "TREATMENT" && dryNeedsCondition !== undefined && dryNeedsCondition !== needsCondition) setNeedsCondition(dryNeedsCondition);
  const blocked = findings.some((f) => f.severity === "BLOCK") || Boolean(dryError);

  function findingText(finding: Finding): string {
    if (finding.code === "UNUSUAL_FOR_STATE") return tFinding("UNUSUAL_FOR_STATE", { chips: (finding.chips ?? []).map((c) => tChip(c as never)).join(", ") });
    // Unknown codes become a generic sentence for their severity; a raw code or the server's English never reaches the screen.
    return tFinding(findingMessageKey(finding) as never);
  }

  /** Esc, the backdrop, X and the phone back arrow all come through here: ask first when something was typed. */
  function requestExit(way: "done" | "back") {
    if (record.isPending) return;
    if (dirty && !unsupported) setConfirmExit(way);
    else if (way === "back") onBack();
    else onDone();
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
    const found = validateValues(def, values, { historical, needsCondition });
    setErrors(found);
    if (Object.keys(found).length > 0 || date > today || blocked) return;
    const request = buildRequest(def, values, { date, time, historical, needsCondition });
    // Send the switches only when the user changed one and the preview came from the server (its rule keys are the ones it
    // understands); a server that does not take the field yet is retried without it in `useRecordEvent`.
    if (dry.data?.source === "route" && followUps.some((item) => isOn(item) !== defaultOn(item))) {
      request.followUps = followUps.map((item) => ({ ruleKey: item.key, enabled: isOn(item) }));
    }
    try {
      const result = await record.mutateAsync({ request, idempotencyKey });
      const ref = result.via === "route" ? extractRef(result.body) : null;
      const message = t("saved", { event: tCatalogue(`${eventKey}.label`), count: followUps.filter(isOn).length });
      if (ref) toast.success(message, { duration: 5000, action: { label: t("undo"), onClick: () => void undo(ref) } });
      else toast.success(message);
      if (another) {
        setNeedsCondition(false);
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
      } else if (error instanceof ApiError && error.details?.eventCode === "CONDITION_REQUIRED") {
        // The preview missed that no case is open: show the Condition field with its error instead of a raw message.
        setNeedsCondition(true);
        setErrors({ condition: "required" });
      } else {
        setServerError(errorMessage(error));
      }
    }
  }

  const shown = def.fields.filter((f) => !f.visibleWhen || f.visibleWhen(values, { historical, needsCondition }));
  const required = shown.filter((f) => !f.detail);
  const details = shown.filter((f) => f.detail);
  const title = `${tCatalogue(`${eventKey}.label`)} · ${cattle.name ?? cattle.tagNumber}`;
  const oneOfNote = def.requireOneOf ? t("requireOneOf") : null;

  /** The drawer: a nested Sheet over the workspace. Radix gives it the focus trap, aria-modal, Esc and the backdrop. */
  const drawer = (children: ReactNode) => (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) requestExit("done");
      }}
    >
      <SheetContent
        showClose={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        className="inset-0 z-[60] flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-xl sm:left-auto sm:w-[min(600px,100%)] sm:max-w-none sm:rounded-l-[18px] sm:border-l motion-reduce:data-[state=open]:slide-in-from-right-0 motion-reduce:data-[state=closed]:slide-out-to-right-0"
      >
        {children}
      </SheetContent>
    </Sheet>
  );

  const header = (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
      <Button type="button" variant="ghost" size="icon" aria-label={t("back")} onClick={() => requestExit("back")} className="sm:hidden">
        <ArrowLeft className="size-4" aria-hidden />
      </Button>
      <SheetTitle ref={titleRef} tabIndex={-1} className="min-w-0 flex-1 truncate text-base outline-none">
        {title}
      </SheetTitle>
      <Button type="button" variant="ghost" size="icon" aria-label={t("close")} onClick={() => requestExit("done")}>
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );

  if (unsupported) {
    return drawer(
      <>
        {header}
        <div role="status" className="flex flex-col gap-4 p-6">
          <p className="text-base font-semibold text-foreground">{t("unsupportedTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("unsupportedBody")}</p>
          {def.fallbackHref ? (
            <Link href={def.fallbackHref} className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
              {t("openHealthcare")}
            </Link>
          ) : null}
          <Button type="button" variant="outline" className="h-10" onClick={onBack}>
            {t("back")}
          </Button>
        </div>
      </>,
    );
  }

  const blockFindings = findings.filter((f) => f.severity === "BLOCK");
  const warnFindings = findings.filter((f) => f.severity !== "BLOCK");
  const fieldProps = (field: (typeof shown)[number]) => ({
    cattleId: cattle.id,
    field,
    values,
    setSibling: setValue,
    value: values[field.name],
    onChange: (v: FormValues[string]) => setValue(field.name, v),
    error: errors[field.name],
    today,
  });

  return drawer(
    <>
      {header}
      <EventContextCard cattle={cattle} strip />

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
        <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6">
          {serverError ? (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive-tint p-3 text-sm text-destructive">
              {serverError}
            </p>
          ) : null}
          {/* Same card idiom as the workspace's WS_CARD (white, 1px border, 16px radius, no shadow). */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-none @min-[480px]:p-5">
            <WhenField date={date} time={time} showTime={Boolean(def.showTime)} today={today} onDateChange={setDate} onTimeChange={setTime} />

            {required.map((field) => (
              <FieldRenderer key={field.name} {...fieldProps(field)} />
            ))}
            {oneOfNote ? <p className="-mt-2 text-xs text-muted-foreground">{oneOfNote}</p> : null}

            {past ? (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
                <Checkbox checked={historical} onCheckedChange={(checked) => setPastOverride(checked === true)} />
                {t("pastRecord")}
              </label>
            ) : null}
          </div>

          {details.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-none @min-[480px]:p-5">
              <button
                type="button"
                aria-expanded={showDetails}
                onClick={() => setShowDetails((open) => !open)}
                className="flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary"
              >
                <ChevronDown className={cn("size-4 transition-transform", showDetails && "rotate-180")} aria-hidden />
                {showDetails ? t("lessDetails") : t("moreDetails")}
              </button>
              {showDetails ? details.map((field) => <FieldRenderer key={field.name} {...fieldProps(field)} />) : null}
            </div>
          ) : null}

          <WhatHappensNext
            items={followUps}
            isOn={isOn}
            onToggle={(item, on) => setToggles((previous) => ({ ...previous, [item.key]: on }))}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {blockFindings.length > 0 || warnFindings.length > 0 || dryError ? (
            <div role="status" aria-live="polite" className="flex max-h-32 flex-col gap-1.5 overflow-y-auto">
              {blockFindings.map((finding) => (
                <p key={`${finding.code}-${finding.severity}`} className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-tint p-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{findingText(finding)}</span>
                </p>
              ))}
              {dryError ? <p className="text-sm text-destructive">{dryError}</p> : null}
              {warnFindings.map((finding) => (
                <p key={`${finding.code}-${finding.severity}`} className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-tint p-2 text-sm text-warning">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {findingText(finding)} {t("saveAnyway")}
                  </span>
                </p>
              ))}
            </div>
          ) : null}

          {confirmExit ? (
            <div role="alert" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-foreground">{t("discardTitle")}</p>
              <div ref={keepEditingRef} className="flex gap-2 sm:justify-end">
                <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" onClick={() => setConfirmExit(null)}>
                  {t("keepEditing")}
                </Button>
                <Button type="button" variant="destructive" className="h-10 flex-1 sm:flex-none" onClick={confirmExit === "back" ? onBack : onDone}>
                  {t("discard")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 max-sm:border-transparent max-sm:shadow-none"
                disabled={record.isPending || blocked}
                onClick={() => void submit(true)}
              >
                {t("saveAnother")}
              </Button>
              <Button type="submit" className="h-10 max-sm:w-full" disabled={record.isPending || blocked}>
                {record.isPending ? t("saving") : t("save")}
              </Button>
            </div>
          )}
        </div>
      </form>
    </>,
  );
}

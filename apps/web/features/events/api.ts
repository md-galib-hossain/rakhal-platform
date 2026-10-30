"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type { EventRequest, Finding, FollowUpPreview } from "./forms/types";
import type { TimelineEvent, TimelineGroup } from "./timeline-model";

/** Server rule keys (04 §3.6) → `events.form.followUp.*` label keys. */
const RULE_LABEL: Record<string, string> = {
  PREG_CHECK_AFTER_BREEDING: "pregCheck",
  HEAT_WATCH_AFTER_HEAT: "returnHeatWatch",
  HEAT_WATCH_AFTER_ABORTION: "returnHeatWatch",
  DRY_OFF_BEFORE_CALVING: "dryOff",
  CALVING_DUE: "calvingDue",
  FRESH_CHECK_AFTER_CALVING: "freshCheck",
  NEXT_DOSE: "nextDose",
};

/** The dry-run body is `{ findings, followUpsPreview }` (RAKHAL-481); read it defensively since its item shapes are not published. */
export function normaliseDryRun(body: unknown, today: string): { findings: Finding[]; followUps: FollowUpPreview[] } {
  const record = (body ?? {}) as { findings?: unknown; followUpsPreview?: unknown };
  const findings: Finding[] = (Array.isArray(record.findings) ? record.findings : [])
    .map((raw): Finding | null => {
      if (typeof raw === "string") return { code: raw, severity: "WARN" };
      const f = raw as { code?: unknown; severity?: unknown; message?: unknown };
      if (typeof f?.code !== "string") return null;
      const severity = f.severity === "BLOCK" || f.severity === "INFO" ? f.severity : "WARN";
      return { code: f.code, severity, message: typeof f.message === "string" ? f.message : undefined };
    })
    .filter((f): f is Finding => f !== null);
  const followUps: FollowUpPreview[] = (Array.isArray(record.followUpsPreview) ? record.followUpsPreview : [])
    .map((raw): FollowUpPreview | null => {
      const f = raw as { ruleKey?: unknown; key?: unknown; dueAt?: unknown; dueDate?: unknown; pastDue?: unknown };
      const key = typeof f?.ruleKey === "string" ? f.ruleKey : typeof f?.key === "string" ? f.key : null;
      if (!key) return null;
      const due = typeof f.dueAt === "string" ? f.dueAt : typeof f.dueDate === "string" ? f.dueDate : null;
      const dueDate = due ? due.slice(0, 10) : null;
      return { key, labelKey: RULE_LABEL[key] ?? "generic", dueDate, pastDue: typeof f.pastDue === "boolean" ? f.pastDue : dueDate !== null && dueDate < today };
    })
    .filter((f): f is FollowUpPreview => f !== null);
  return { findings, followUps };
}

export interface TimelineQuery {
  group: TimelineGroup | null;
  includeVoided: boolean;
}

export const eventsApi = {
  /** RAKHAL-481 — `POST /cattle/:id/events?dryRun=true`: same code path as a save, rolled back; returns findings and the follow-ups it would create. */
  dryRun(cattleId: string, request: EventRequest): Promise<unknown> {
    return apiFetch<unknown>(`/cattle/${cattleId}/events`, { method: "POST", body: request, searchParams: { dryRun: true } });
  },
  /** RAKHAL-481 — records the event. `idempotencyKey` is stable per form open, so a double tap or retry cannot record twice. */
  create(cattleId: string, request: EventRequest, idempotencyKey: string): Promise<unknown> {
    return apiFetch<unknown>(`/cattle/${cattleId}/events`, {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    });
  },
  /** `POST /cattle/:id/events/:ref/void` (02 §3.8) — used by the Undo toast. */
  void(cattleId: string, ref: string, reason: string): Promise<unknown> {
    return apiFetch<unknown>(`/cattle/${cattleId}/events/${encodeURIComponent(ref)}/void`, { method: "POST", body: { reason } });
  },
  /**
   * RAKHAL-479 — `GET /cattle/:id/events`: one animal's event headers + detail, newest first, cursor on
   * (eventAt, type, id). `group` is one of REPRODUCTION | HEALTH | GROWTH | MOVEMENT | OTHER
   * (`ListCattleEventsDto`); `includeVoided` defaults to false; `limit` 1-100 (default 30).
   */
  timeline(cattleId: string, query: TimelineQuery, cursor: string | undefined, limit: number): Promise<CursorPage<TimelineEvent>> {
    return apiFetchPage<TimelineEvent>(`/cattle/${cattleId}/events`, {
      searchParams: {
        cursor,
        limit,
        group: query.group ?? undefined,
        includeVoided: query.includeVoided ? true : undefined,
      },
    });
  },
};

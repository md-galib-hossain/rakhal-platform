import type { ClinicalProgress, HealthCaseDetail, HealthTask, HealthTaskStatus } from "./types";

/**
 * The case's story as one list (RFE-135, EPIC_HEALTH_CENTER D4): reported → health updates → treatments / protocol
 * steps → closed. Pure — the timeline component translates; this only decides *what happened when*.
 *
 * A completed protocol step that was recorded through "Log treatment" already has a `TreatmentLog` (linked by
 * `healthTaskId`); showing both would say the same thing twice, so the treatment event carries the step label instead
 * and the step itself is dropped. Steps still `PENDING` are the future, not history — they live in the summary strip's
 * "next step", not here.
 */
export type CaseEvent =
  | { kind: "opened"; id: string; at: string; condition: string | null; note: string | null; priority: string; actor: string | null }
  | {
      kind: "update";
      id: string;
      at: string;
      progress: ClinicalProgress;
      temperature: number | null;
      observation: string | null;
      actor: string | null;
    }
  | {
      kind: "treatment";
      id: string;
      at: string;
      medicine: string | null;
      dose: string | null;
      route: string | null;
      actor: string | null;
      step: { number: number; total: number | null; title: string } | null;
    }
  | { kind: "step"; id: string; at: string; status: Exclude<HealthTaskStatus, "PENDING" | "COMPLETED">; title: string }
  | { kind: "stepDone"; id: string; at: string; title: string }
  | { kind: "closed"; id: string; at: string; status: string; reason: string | null }
  | { kind: "mortality"; id: string; at: string; cause: string };

/** `administeredBy` / `recordedBy` hold a person's name on some rows and a raw user id on others (the field is a free
 * string on the backend). A cuid is never a useful thing to show — drop it rather than print it. */
export function readableActor(actor: string | null | undefined): string | null {
  if (!actor) return null;
  return /^c[a-z0-9]{20,}$/.test(actor) ? null : actor;
}

function stepInfo(task: HealthTask | undefined) {
  return task && task.stepNumber != null ? { number: task.stepNumber, total: task.totalSteps, title: task.title } : null;
}

export function buildCaseEvents(c: HealthCaseDetail): CaseEvent[] {
  const events: CaseEvent[] = [
    {
      kind: "opened",
      id: `opened-${c.id}`,
      at: c.startDate,
      condition: c.condition,
      note: c.note,
      priority: c.priority,
      actor: readableActor(c.reportedBy),
    },
  ];

  const tasksById = new Map(c.tasks.map((task) => [task.id, task]));
  const loggedTaskIds = new Set<string>();

  for (const update of c.healthUpdates) {
    events.push({
      kind: "update",
      id: `update-${update.id}`,
      at: update.recordedAt,
      progress: update.clinicalProgress,
      temperature: update.temperature,
      observation: update.observation,
      actor: readableActor(update.recordedBy),
    });
  }

  for (const log of c.treatmentLogs) {
    if (log.healthTaskId) loggedTaskIds.add(log.healthTaskId);
    events.push({
      kind: "treatment",
      id: `treatment-${log.id}`,
      at: log.administeredAt,
      medicine: log.medicineName,
      dose: log.doseAmount != null ? `${log.doseAmount} ${log.doseUnit ?? ""}`.trim() : null,
      route: log.route,
      actor: readableActor(log.administeredBy),
      step: log.healthTaskId ? stepInfo(tasksById.get(log.healthTaskId)) : null,
    });
  }

  for (const task of c.tasks) {
    if (task.status === "PENDING") continue;
    if (task.status === "COMPLETED") {
      if (loggedTaskIds.has(task.id)) continue;
      events.push({ kind: "stepDone", id: `step-${task.id}`, at: task.completedAt ?? task.dueDateTime, title: task.title });
      continue;
    }
    events.push({ kind: "step", id: `step-${task.id}`, at: task.dueDateTime, status: task.status, title: task.title });
  }

  if (c.mortalityRecord) {
    events.push({ kind: "mortality", id: `mortality-${c.mortalityRecord.id}`, at: c.mortalityRecord.deathDate, cause: c.mortalityRecord.primaryCauseOfDeath });
  } else if (c.closedDate) {
    events.push({ kind: "closed", id: `closed-${c.id}`, at: c.closedDate, status: c.status, reason: c.closeReason ?? null });
  }

  // Newest first; the case opening always sits last when timestamps tie.
  return events.sort((a, b) => b.at.localeCompare(a.at) || (a.kind === "opened" ? 1 : b.kind === "opened" ? -1 : 0));
}

/** "What next" for an open case (EPIC D4) — one suggestion, in priority order. */
export type WhatNext =
  | { kind: "applyProtocol" }
  | { kind: "recordStep"; task: HealthTask; overdue: boolean }
  | { kind: "closeRecovered" }
  | null;

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function suggestNext(c: HealthCaseDetail, now: Date = new Date()): WhatNext {
  const closed = c.status === "RECOVERED" || c.status === "MORTALITY" || c.status === "CLOSED";
  if (closed) return null;

  const pending = c.tasks.filter((task) => task.status === "PENDING" || task.status === "RESCHEDULED" || task.status === "OVERDUE");
  const next = [...pending].sort((a, b) => a.dueDateTime.localeCompare(b.dueDateTime))[0];
  if (next) {
    const days = Math.round((startOfDay(new Date(next.dueDateTime)) - startOfDay(now)) / DAY_MS);
    if (days <= 0) return { kind: "recordStep", task: next, overdue: days < 0 };
  }

  if (!c.summary?.protocol && pending.length === 0) return { kind: "applyProtocol" };

  // Improving on the last three updates with nothing left to do → time to close it.
  const latest = [...c.healthUpdates].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 3);
  if (pending.length === 0 && latest.length === 3 && latest.every((u) => u.clinicalProgress === "IMPROVING")) {
    return { kind: "closeRecovered" };
  }
  return null;
}

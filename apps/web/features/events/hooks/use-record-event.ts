"use client"; // TanStack Query hooks

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { eventsApi, normaliseDryRun } from "../api";
import { FALLBACK } from "../forms/fallback";
import { clientFindings, previewFollowUps } from "../forms/followups";
import type { DryRunResult, EventRequest, FormValues } from "../forms/types";
import type { AnimalFacts, EventKey } from "../types";

/** Raised when the event can only be recorded through `POST /cattle/:id/events` and that route is not deployed yet. */
export class EventUnavailableError extends Error {
  constructor() {
    super("EVENT_ROUTE_UNAVAILABLE");
    this.name = "EventUnavailableError";
  }
}

/** An opaque `ref` (02 §3.8) from a create response, when there is one — what Undo voids. */
export function extractRef(body: unknown): string | null {
  const b = (body ?? {}) as { ref?: unknown; event?: { ref?: unknown; id?: unknown }; id?: unknown };
  const ref = b.ref ?? b.event?.ref ?? b.event?.id ?? b.id;
  return typeof ref === "string" ? ref : null;
}

/**
 * "What would happen" for the form's current input: the server dry run when `POST /cattle/:id/events?dryRun=true`
 * answers, otherwise findings and follow-ups computed on the client. A 400/422 is not swallowed: it means the input is
 * impossible, and the form shows it.
 */
export function useEventDryRun({
  cattleId,
  eventKey,
  facts,
  values,
  date,
  today,
  request,
  enabled,
}: {
  cattleId: string;
  eventKey: EventKey;
  facts: AnimalFacts;
  values: FormValues;
  date: string;
  today: string;
  request: EventRequest | null;
  enabled: boolean;
}) {
  return useQuery<DryRunResult>({
    queryKey: ["events", "dry-run", cattleId, request],
    enabled: enabled && request !== null,
    staleTime: 10_000,
    retry: false,
    queryFn: async () => {
      const client = (): DryRunResult => ({
        source: "client",
        findings: clientFindings(eventKey, facts, date, today),
        followUps: previewFollowUps(eventKey, values, date, today),
      });
      try {
        const body = await eventsApi.dryRun(cattleId, request as EventRequest);
        const server = normaliseDryRun(body, today);
        // The server's preview names the rules but carries no dates; fill them from the same rules computed here.
        const dates = new Map(previewFollowUps(eventKey, values, date, today).map((item) => [item.key, item]));
        return {
          source: "route",
          findings: server.findings,
          followUps: server.followUps.map((item) => {
            const known = dates.get(item.key);
            return known && item.dueDate === null ? { ...item, dueDate: known.dueDate, pastDue: known.pastDue } : item;
          }),
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return client();
        throw error;
      }
    },
  });
}

export function useRecordEvent(cattleId: string, eventKey: EventKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ request, idempotencyKey }: { request: EventRequest; idempotencyKey: string }) => {
      try {
        const body = await eventsApi.create(cattleId, request, idempotencyKey);
        return { via: "route" as const, body };
      } catch (error) {
        // A server that does not take `followUps` yet rejects it as an unknown property; nothing was saved, so retry without.
        if (error instanceof ApiError && error.status === 400 && request.followUps && /followUps/i.test(error.message)) {
          const withoutToggles = { ...request };
          delete withoutToggles.followUps;
          return { via: "route" as const, body: await eventsApi.create(cattleId, withoutToggles, idempotencyKey) };
        }
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        const fallback = FALLBACK[eventKey];
        if (!fallback) throw new EventUnavailableError();
        return { via: "fallback" as const, body: await fallback(cattleId, request) };
      }
    },
    onSuccess: () => {
      // An event moves state everywhere: the animal, its timeline, Next up, reproduction, health and the task list.
      for (const key of ["cattle", "events", "reproduction", "health", "healthcare", "tasks"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useVoidEvent(cattleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ref, reason }: { ref: string; reason: string }) => eventsApi.void(cattleId, ref, reason),
    onSuccess: () => {
      for (const key of ["cattle", "events", "reproduction", "health", "tasks"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

import { cattleApi } from "@/features/cattle/api";
import { reproductionApi } from "@/features/reproduction/api";
import type { EventKey } from "../types";
import type { EventRequest } from "./types";

type Executor = (cattleId: string, request: EventRequest) => Promise<unknown>;

/** Local `YYYY-MM-DDTHH:mm` for the endpoints that take a `datetime-local` string. */
function localDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const str = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);
const flag = (value: unknown): boolean | undefined => (value === true ? true : undefined);

/**
 * Used only while `POST /cattle/:id/events` (RAKHAL-481) answers 404: the events whose existing per-domain endpoint
 * takes the form's data. Everything else (AI with its cost rules, preg check without an AI, calving, treatments,
 * fattening, move, note) needs the new route, so `use-record-event.ts` reports "not available yet" for them.
 * These endpoints still apply the old chain rules and have no dry run, no follow-up toggles and no HISTORICAL tag.
 */
export const FALLBACK: Partial<Record<EventKey, Executor>> = {
  HEAT: (cattleId, r) =>
    reproductionApi.createHeatEvent({
      cattleId,
      heatDateTime: r.eventAt,
      detectionMethod: (str(r.payload.detectionMethod) ?? "VISUAL") as "VISUAL" | "MANUAL" | "COLLAR_SENSOR" | "PEDOMETER",
      standingHeat: flag(r.payload.standingHeat),
      mucusDischarge: flag(r.payload.mucusDischarge),
      mountingBehavior: flag(r.payload.mountingBehavior),
      restlessness: flag(r.payload.restlessness),
      notes: r.notes,
    }),
  ABORTION: (cattleId, r) =>
    reproductionApi.createAbortionEvent({
      cattleId,
      abortionDate: r.eventAt,
      gestationDay: num(r.payload.gestationDay),
      suspectedCause: str(r.payload.suspectedCause),
      notes: r.notes,
    }),
  DRY_OFF: (cattleId, r) =>
    reproductionApi.recordDryOff(cattleId, {
      dryOffDate: r.eventAt,
      reason: str(r.payload.reason) as "SCHEDULED" | "LOW_PRODUCTION" | "HEALTH" | "PREGNANCY" | "MANAGEMENT_DECISION" | undefined,
      notes: r.notes,
    }),
  WEIGHT: (cattleId, r) =>
    cattleApi.recordWeight(cattleId, { weightKg: Number(r.payload.weightKg), date: localDateTime(r.eventAt), notes: r.notes }),
  BCS: (cattleId, r) => cattleApi.recordBcs(cattleId, { score: Number(r.payload.score), date: localDateTime(r.eventAt), notes: r.notes }),
};

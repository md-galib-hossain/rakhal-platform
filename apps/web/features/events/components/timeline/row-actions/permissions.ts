import { FORM_DEFS } from "../../../forms/definitions";
import type { EventKey } from "../../../types";
import type { TimelineEvent, TimelineEventType } from "../../../timeline-model";

/** Hub Q5, mirrored from the backend (`AUTHOR_WINDOW_MS`): the author may edit or void within 24 h; `cattle.event.void` any time. */
export const AUTHOR_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * 03 §3.4 — Edit / Void are offered when the user may record events at all and is the author within 24 h of entering it,
 * or can void anyone's. A voided row, or a row without a server author (the fallback rows), offers nothing.
 */
export function canChangeEvent(
  event: Pick<TimelineEvent, "status" | "recordedById" | "createdAt">,
  user: { id: string | null; canRecord: boolean; canVoid: boolean },
  now: number = Date.now(),
): boolean {
  if (event.status === "VOIDED" || !user.canRecord) return false;
  if (user.canVoid) return true;
  if (!user.id || !event.recordedById || event.recordedById !== user.id || !event.createdAt) return false;
  return now - new Date(event.createdAt).getTime() <= AUTHOR_WINDOW_MS;
}

/** The record-form key that records the same kind of event (Copy to another animal); null when there is no form for it. */
export function formKeyForType(type: TimelineEventType): EventKey | null {
  for (const [key, def] of Object.entries(FORM_DEFS)) {
    if (def && def.backendType === type) return key as EventKey;
  }
  return null;
}

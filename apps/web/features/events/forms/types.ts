import type { EventKey } from "../types";

export type FieldKind = "segmented" | "select" | "medicine" | "number" | "text" | "textarea" | "date" | "bool" | "shed" | "group";

export interface FieldDef {
  name: string;
  kind: FieldKind;
  required?: boolean;
  /** Required unless the entry is a past record (HISTORICAL): a live health entry deducts stock and needs the full dose. */
  requiredWhenLive?: boolean;
  /** Listed under "More details" (collapsed by default); required fields are never details. */
  detail?: boolean;
  /** `segmented` / `select`: the allowed values; labels come from `events.options.<name>.<value>`. */
  options?: string[];
  /** Read option labels from this existing i18n namespace instead (e.g. the health conditions). */
  optionLabels?: string;
  default?: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** `notes` sends the value as the event's top-level notes instead of inside `payload`. */
  target?: "payload" | "notes";
}

export interface FormDef {
  key: EventKey;
  /** Backend `AnimalEventType` (RAKHAL-478). */
  backendType: string;
  fields: FieldDef[];
  /** Heat, service and calving record a time of day as well as a date (03 §5.2). */
  showTime?: boolean;
  /** Where to send the user while the server cannot record this event yet (`EVENT_TYPE_NOT_SUPPORTED`). */
  fallbackHref?: string;
  /** At least one of these fields must be filled (Move needs a shed or a group). */
  requireOneOf?: string[];
  /** Last-step reshaping of the payload (e.g. nesting the calf row). */
  transform?: (payload: Record<string, unknown>) => Record<string, unknown>;
}

export type FormValues = Record<string, string | number | boolean | undefined>;

/** Body of `POST /cattle/:id/events` (`RecordEventDto`, RAKHAL-481): exactly these properties; the server rejects extras. */
export interface EventRequest {
  type: string;
  eventAt: string;
  provenance: "RECORDED" | "HISTORICAL";
  notes?: string;
  sourceEventId?: string;
  payload: Record<string, unknown>;
  /** "What happens next" switches that differ from the server's defaults (RAKHAL-481 follow-up contract). */
  followUps?: { ruleKey: string; enabled: boolean }[];
}

export interface Finding {
  code: string;
  severity: "INFO" | "WARN" | "BLOCK";
  message?: string;
  /** Client-side only: the animal states that make this unusual (resolved to labels in the UI). */
  chips?: string[];
}

export interface FollowUpPreview {
  key: string;
  /** i18n key under `events.form.followUp.*`. */
  labelKey: string;
  /** `YYYY-MM-DD`, or null when the server decides. */
  dueDate: string | null;
  pastDue: boolean;
  /** From the server preview (`{ruleKey, title, dueDate, defaultOn}`): its own label and its default switch. */
  title?: string;
  defaultOn?: boolean;
}

/** Result of a dry run, from the real route or computed on the client. */
export interface DryRunResult {
  source: "route" | "client";
  findings: Finding[];
  followUps: FollowUpPreview[];
}

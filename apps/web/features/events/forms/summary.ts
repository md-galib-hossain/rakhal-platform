import type { TimelineEvent } from "../timeline-model";

/**
 * RFE-178 (06-modal-rebuild §6): the one-line summary under a timeline row's title, one branch per event type.
 * Reads the real `GET /cattle/:id/events` shape — `detail` is the type's own table row (heat, breeding, preg check,
 * calving, weight, treatment …) and `data` on the header carries the payload of the types that have no table (note,
 * custom, vaccination's `nextDoseDays`). Pure: labels come in through `labels`, so it is unit-tested without React.
 *
 * Rule: never print an id, a seeded `E2E-…` name or a raw enum key. A part that cannot be shown safely is dropped.
 */

export interface SummaryLabels {
  /** `events.timeline.summary.*` — `t("weight", { kg })`. */
  t: (key: string, values?: Record<string, string | number>) => string;
  /** `events.options.<group>.<VALUE>` — null when the value has no label (unknown enum keys are dropped). */
  option: (group: string, value: unknown) => string | null;
  /** `health.reportSickness.conditionValue.<KEY>` — null when unknown. */
  condition: (value: unknown) => string | null;
}

export type SummarySource = Pick<TimelineEvent, "type" | "detail"> & { data?: Record<string, unknown> | null };

const CUID = /^c[a-z0-9]{20,}$/;
const EVENT_ID = /^ae_[0-9a-f]{16,}$/i;
const SEEDED = /^E2E[-_ ]/i;
const ENUM_KEY = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const SEP = " · ";

/** A user-entered string that is safe to print, or null. */
export function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || CUID.test(text) || EVENT_ID.test(text) || SEEDED.test(text) || ENUM_KEY.test(text)) return null;
  return text;
}

/** Prisma `Decimal`s arrive as strings ("1", "2.50"); Floats as numbers. */
function num(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function join(parts: (string | null | false | undefined)[]): string | null {
  const out = parts.filter((part): part is string => Boolean(part));
  return out.length ? out.join(SEP) : null;
}

function dose(detail: Record<string, unknown>): string | null {
  const amount = num(detail.doseAmount);
  const unit = safeText(detail.doseUnit);
  return amount === null ? null : unit ? `${amount} ${unit}` : String(amount);
}

/** A product name without the batch / test-code tail some rows carry ("Lumpy skin · batch RAKHAL346-E2E" -> "Lumpy skin"). */
export function productName(value: unknown): string | null {
  const text = safeText(value);
  if (!text) return null;
  const clean = text
    .replace(/\s*[·,;(-]?\s*\b(batch|lot)\b.*$/i, "")
    .replace(/\s*[·,;(-]?\s*\S*E2E\S*.*$/i, "")
    .trim();
  return safeText(clean);
}

function drug(detail: Record<string, unknown>, data: Record<string, unknown>, labels: SummaryLabels): string | null {
  const next = num(data.nextDoseDays);
  return join([
    productName(detail.medicineName),
    dose(detail),
    labels.option("route", detail.route),
    next !== null && labels.t("nextDose", { days: next }),
  ]);
}

export function formatEventSummary(event: SummarySource, labels: SummaryLabels): string | null {
  const detail = event.detail ?? {};
  const data = event.data ?? {};
  const { t, option } = labels;

  switch (event.type) {
    case "HEAT": {
      const signs = [
        detail.standingHeat === true && t("heat.standing"),
        detail.mucusDischarge === true && t("heat.mucus"),
        detail.mountingBehavior === true && t("heat.mounting"),
        detail.restlessness === true && t("heat.restless"),
      ].filter(Boolean) as string[];
      return join([signs.join(", ") || null, option("detectionMethod", detail.detectionMethod)]);
    }
    case "BREEDING": {
      const bull = safeText(detail.sireNameOrCode);
      const by = safeText(detail.inseminator);
      return join([
        option("breedingMethod", detail.breedingMethod),
        bull && t("bull", { name: bull }),
        by && t("by", { name: by }),
      ]);
    }
    case "PREG_CHECK": {
      const day = num(detail.gestationDay);
      return join([
        option("result", detail.result),
        day !== null && t("day", { day }),
        option("diagnosisMethod", detail.diagnosisMethod),
      ]);
    }
    case "CALVING": {
      const count = num(detail.calfCount);
      return join([count !== null && t("calves", { count }), option("calvingEase", detail.calvingEase)]);
    }
    case "ABORTION": {
      const day = num(detail.gestationDay);
      return join([day !== null && t("day", { day }), safeText(detail.suspectedCause)]);
    }
    case "DRY_OFF":
      return option("reason", detail.reason);
    case "ILLNESS":
      // The live row carries only `data.healthCaseId` (an id: never shown); a condition is shown when the payload has one.
      return labels.condition(detail.condition ?? data.condition);
    case "TREATMENT":
    case "VACCINATION":
    case "DEWORMING":
      return drug(detail, data, labels);
    case "WEIGHT": {
      const kg = num(detail.weightKg);
      return kg === null ? null : t("weight", { kg });
    }
    case "BCS": {
      const score = num(detail.score);
      return score === null ? null : t("bcs", { score });
    }
    case "WEANING": {
      const kg = num(detail.weaningWeightKg);
      return kg === null ? null : t("weight", { kg });
    }
    case "MOVE":
      return join([safeText(data.shedName), safeText(data.groupName)]);
    case "SOLD": {
      const price = num(detail.price);
      return join([price !== null && t("price", { amount: price }), safeText(detail.reason)]);
    }
    case "CULLED":
      return safeText(detail.reason);
    case "DIED":
      return safeText(detail.primaryCauseOfDeath);
    case "NOTE":
      return safeText(data.text);
    case "CUSTOM": {
      const values = Object.values(data)
        .map((value) => (typeof value === "number" && Number.isFinite(value) ? String(value) : safeText(value)))
        .filter((value): value is string => Boolean(value))
        .slice(0, 3);
      return values.length ? values.join(SEP) : null;
    }
    default:
      // CASTRATION, ENTER_FATTENING, LEAVE_FATTENING, HOOF_TRIM, DEHORN: the title says it all.
      return null;
  }
}

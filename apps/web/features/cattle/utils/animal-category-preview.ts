import type { AnimalCategory, CattleGender } from "../types";

/**
 * UI-preview-only mirror of the backend's real derivation
 * (`rakhal-backend/src/modules/cattle/domain/animal-category.ts#deriveAnimalCategory`, RAKHAL-270).
 * The server remains the source of truth on save (`composeStatus()` recomputes this from the
 * persisted `gender`/`dateOfBirth`/`totalCalvings` on every read) — this copy exists solely to
 * render a live "Will be added as: …" badge in `CattleFormDialog` before the record is created, so
 * it must stay logically identical to the backend function, not merely similar.
 *
 * `DEFAULT_WEANING_DAYS = 60` is copied verbatim from the backend's
 * `src/modules/calf/domain/calf-stage.ts` (PRD §14.4 — "birth date + 60 days", configurable) — if
 * that constant ever changes server-side, this one must be updated to match.
 */
export const PREVIEW_WEANING_DAYS = 60;

export interface DeriveAnimalCategoryPreviewInput {
  gender: CattleGender;
  /** `yyyy-MM-dd` string, as produced by `DatePicker`/`toFormDefaults`. */
  dateOfBirth: string | null | undefined;
  /** The form's `priorCalvings` input — a new (not-yet-created) animal has no calving history of
   * its own beyond what the user declares here (e.g. a purchased already-calved cow). */
  priorCalvings: number | null | undefined;
  now?: Date;
}

function ageInDaysPreview(dateOfBirth: Date, now: Date): number {
  const days = Math.floor((now.getTime() - dateOfBirth.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

/** Mirrors `deriveAnimalCategory()` — see the file doc comment above. */
export function deriveAnimalCategoryPreview({
  gender,
  dateOfBirth,
  priorCalvings,
  now = new Date(),
}: DeriveAnimalCategoryPreviewInput): AnimalCategory {
  const dob = dateOfBirth ? new Date(`${dateOfBirth}T00:00:00`) : null;
  if (dob && !Number.isNaN(dob.getTime()) && ageInDaysPreview(dob, now) < PREVIEW_WEANING_DAYS) {
    return "CALF";
  }

  const totalCalvings = priorCalvings ?? 0;
  switch (gender) {
    case "FEMALE":
      return totalCalvings > 0 ? "COW" : "HEIFER";
    case "MALE":
      return "BULL";
    case "CASTRATED_MALE":
      return "STEER";
  }
}

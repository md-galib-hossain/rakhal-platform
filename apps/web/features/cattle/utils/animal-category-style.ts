import type { ChipProps } from "@rakhal/ui/ui/chip";
import type { AnimalCategory } from "../types";

/**
 * RAKHAL-402 — single source of truth for the `AnimalCategory` (CALF/HEIFER/COW/BULL/STEER,
 * RAKHAL-270) chip color convention. Previously duplicated verbatim as `ANIMAL_CATEGORY_VARIANT`
 * across `cattle-columns.tsx`, `cattle-grid.tsx`, `cattle-form-dialog.tsx`, and
 * `detail/cattle-profile-card.tsx`, plus a CSS-custom-property mirror in the dashboard's
 * `herd-status-donut.tsx` — collapsed here so the 5 values can no longer drift apart.
 */
export const ANIMAL_CATEGORY_VARIANT: Record<AnimalCategory, ChipProps["variant"]> = {
  CALF: "info",
  HEIFER: "purple",
  COW: "primary",
  BULL: "indigo",
  STEER: "teal",
};

/** Same 5-color convention as `ANIMAL_CATEGORY_VARIANT`, expressed as the matching CSS custom
 * properties for non-`Chip` consumers (recharts fills, etc — see `herd-status-donut.tsx`). */
export const ANIMAL_CATEGORY_SLICE_COLOR: Record<AnimalCategory, string> = {
  CALF: "var(--info)",
  HEIFER: "var(--accent-purple)",
  COW: "var(--primary)",
  BULL: "var(--accent-indigo)",
  STEER: "var(--accent-teal)",
};

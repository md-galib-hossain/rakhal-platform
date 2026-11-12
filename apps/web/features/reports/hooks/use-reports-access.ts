"use client";

import { useCan } from "@/lib/auth/permissions";
import { useHasFeature } from "@/features/subscription/hooks/use-subscription-gates";

/** Plan feature that gates preview / create / retry on the backend (`@RequireFeature('reports.generate')`). */
export const REPORTS_GENERATE_FEATURE = "reports.generate";

export interface ReportsAccess {
  /** `reports.read` — list, open, download, templates. */
  canRead: boolean;
  /** `reports.create` — generate and retry. */
  canCreate: boolean;
  /** `reports.delete` — the backend further restricts this to the farm owner (`REPORT_OWNER_ONLY`). */
  canDelete: boolean;
  /** `finance.read` — finance metrics appear in the catalogue/reports only with this. */
  canViewFinance: boolean;
  /**
   * The farm's plan includes `reports.generate` (from `GET /subscription` -> `features`, via
   * `useHasFeature`). False while the subscription is still loading or when the plan lacks it.
   */
  canUseFeature: boolean;
}

/** Single place the Reports UI asks "may this user do X". UX gating only; the backend enforces. */
export function useReportsAccess(): ReportsAccess {
  const can = useCan();
  const hasFeature = useHasFeature();
  return {
    canRead: can("reports.read"),
    canCreate: can("reports.create"),
    canDelete: can("reports.delete"),
    canViewFinance: can("finance.read"),
    canUseFeature: hasFeature(REPORTS_GENERATE_FEATURE),
  };
}

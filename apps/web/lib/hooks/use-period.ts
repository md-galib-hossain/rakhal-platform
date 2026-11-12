"use client";

import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { parseAsIsoDate, parseAsStringEnum, useQueryStates } from "nuqs";
import type { Locale } from "@/lib/constants/i18n";
import { formatDate } from "@/lib/format";
import {
  PERIOD_PRESET_VALUES,
  presetToRange,
  type PeriodPreset,
  type PeriodRange,
} from "@/lib/period/presets";

export interface UsePeriodResult extends PeriodRange {
  preset: PeriodPreset;
  /** Human-readable label ("This Month", or a formatted "Aug 1 – 25, 2026" for
   * a custom range) — the client only ever formats this; the actual numbers
   * behind it are always server-computed. */
  label: string;
  setPreset: (preset: Exclude<PeriodPreset, "custom">) => void;
  setRange: (from: Date, to: Date) => void;
}

/**
 * `usePeriod()` (RAKHAL-380, MILESTONE 22, `BUSINESS_IA_PRD.md` §4.4, §6.1).
 * nuqs-backed `?from&to&preset` URL state — matching the `useQueryState`
 * convention `finance-tabs.tsx`/`ledger-view.tsx` already use for their own
 * tab/segment params. Because it is URL state, the selected period survives
 * navigation between Finance / Sales / Purchasing (a shared cross-module
 * concern, not a per-page `useState`).
 *
 * `preset` is the source of truth; `from`/`to` only appear in the URL for
 * `preset=custom` (a `DateRangePicker` selection) — every named preset
 * derives its range fresh from "now" via `presetToRange` on every read, so a
 * bookmarked `?preset=this_month` link always means "this month", not the
 * month it was bookmarked in.
 */
export function usePeriod(defaultPreset: Exclude<PeriodPreset, "custom"> = "this_month"): UsePeriodResult {
  const locale = useLocale() as Locale;
  const t = useTranslations("period.presets");

  const [state, setState] = useQueryStates({
    preset: parseAsStringEnum<PeriodPreset>(PERIOD_PRESET_VALUES).withDefault(defaultPreset),
    from: parseAsIsoDate,
    to: parseAsIsoDate,
  });

  const range = useMemo<PeriodRange>(() => {
    if (state.preset === "custom" && state.from && state.to) {
      return { from: state.from, to: state.to };
    }
    return presetToRange(state.preset === "custom" ? defaultPreset : state.preset);
  }, [state.preset, state.from, state.to, defaultPreset]);

  const label = useMemo(() => {
    if (state.preset === "custom") {
      return `${formatDate(range.from, locale)} – ${formatDate(range.to, locale)}`;
    }
    return t(state.preset);
  }, [state.preset, range, locale, t]);

  const setPreset = useCallback(
    (preset: Exclude<PeriodPreset, "custom">) => {
      void setState({ preset, from: null, to: null });
    },
    [setState],
  );

  const setRange = useCallback(
    (from: Date, to: Date) => {
      void setState({ preset: "custom", from, to });
    },
    [setState],
  );

  return { ...range, preset: state.preset, label, setPreset, setRange };
}

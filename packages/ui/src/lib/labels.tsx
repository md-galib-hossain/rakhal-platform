"use client";

import { createContext, useContext } from "react";

/** Short UI strings a locale-aware shared component needs but can't format itself (unlike
 * `formatMoney`/`formatDate` in `./locale.tsx`, these aren't derivable from a `Locale` code alone —
 * they're real copy). Grouped by component so one `LabelsProvider` wired once at the app's root
 * covers every component that needs this seam, instead of one context per component. */
export interface SharedLabels {
  datePicker: {
    today: string;
    clear: string;
  };
  dateTimePicker: {
    time: string;
    hour: string;
    minute: string;
    now: string;
    clear: string;
    done: string;
  };
}

const LabelsContext = createContext<SharedLabels | null>(null);

/** Wrap once near the app's root, forwarding whatever translations the app already resolved
 * (e.g. next-intl's `getTranslations()` in a server layout). */
export function LabelsProvider({ labels, children }: { labels: SharedLabels; children: React.ReactNode }) {
  return <LabelsContext.Provider value={labels}>{children}</LabelsContext.Provider>;
}

/** Throws if used outside a `LabelsProvider` — a shared component silently falling back to a
 * hardcoded English string is worse than a loud error during development. */
export function useLabels(): SharedLabels {
  const labels = useContext(LabelsContext);
  if (labels === null) {
    throw new Error("useLabels() must be called within a <LabelsProvider>.");
  }
  return labels;
}

import type { ChipProps } from "@/components/ui/chip";
import type { Locale } from "@/lib/constants/i18n";
import type { HealthPriority } from "./types";

/** Deterministic per-diagnosis chip color (Figma's sick-bay table colors each diagnosis chip
 * distinctly — Mastitis red, Hoof Root amber, Pink Eye purple — but the backend's `diagnosis` is a
 * free-text string, not a closed enum, so this hashes the label into a fixed rotation rather than
 * hard-coding names, same approach as `features/inventory/avatar-tint.ts`. */
const DIAGNOSIS_VARIANTS: NonNullable<ChipProps["variant"]>[] = [
  "destructive",
  "warning",
  "purple",
  "info",
  "teal",
  "primary",
];

export function diagnosisChipVariant(diagnosis: string | null): NonNullable<ChipProps["variant"]> {
  if (!diagnosis) return "muted";
  let hash = 0;
  for (let i = 0; i < diagnosis.length; i++) hash = (hash * 31 + diagnosis.charCodeAt(i)) | 0;
  return DIAGNOSIS_VARIANTS[Math.abs(hash) % DIAGNOSIS_VARIANTS.length];
}

export function priorityChipVariant(priority: HealthPriority): NonNullable<ChipProps["variant"]> {
  switch (priority) {
    case "CRITICAL":
    case "HIGH":
      return "destructive";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "muted";
  }
}

/** "Today"/"Tomorrow"/date label + time — Figma's Next Dose column (e.g. "Today, 2:00 PM"). */
export function formatDoseWhen(dateTime: string, locale: Locale, todayLabel: string, tomorrowLabel: string): { day: string; time: string } {
  const d = new Date(dateTime);
  const now = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  const day =
    diffDays === 0
      ? todayLabel
      : diffDays === 1
        ? tomorrowLabel
        : new Intl.DateTimeFormat(locale === "bn" ? "bn-BD-u-nu-latn" : "en-US", { day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD-u-nu-latn" : "en-US", { hour: "numeric", minute: "2-digit" }).format(d);
  return { day, time };
}

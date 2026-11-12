import { Chip, type ChipProps } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

/**
 * WCAG AA text colours (tokens `--*-text`, theme-aware via `.dark`) for the tinted ("subtle") chip. The token colours (`text-destructive` #ef4444,
 * `text-warning` #f59e0b, `text-primary` #00a86b ...) are 2-3:1 on their own 15% tint; the `-text` tokens clear 4.5:1
 * for 12px text and equal the brand colour in dark mode.
 */
const LIGHT_TEXT: Partial<Record<NonNullable<ChipProps["variant"]>, string>> = {
  destructive: "text-destructive-text",
  warning: "text-warning-text",
  primary: "text-primary-text",
  info: "text-info-text",
};

/** Same tint-and-text pairs for the small count badges in the filter tabs. */
export const BADGE_TONE = {
  destructive: "bg-destructive/15 text-destructive-text",
  warning: "bg-warning/15 text-warning-text",
  primary: "bg-primary/15 text-primary-text",
} as const;

export function TaskChip({ variant, subtle, className, ...props }: ChipProps) {
  return <Chip variant={variant} subtle={subtle} className={cn(variant && LIGHT_TEXT[variant], className)} {...props} />;
}

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/** Outline status pill — Figma "Chip" component (Cattle table status/health columns): white/card
 * fill, a colored border, bold colored text. Distinct from `Badge` (solid tint fill), which stays
 * the app's default for profile-card/detail-header status display. */
const chipVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold",
  {
    variants: {
      variant: {
        primary: "border-primary text-primary",
        info: "border-info text-info",
        warning: "border-warning text-warning",
        teal: "border-accent-teal text-accent-teal",
        purple: "border-accent-purple text-accent-purple",
        indigo: "border-accent-indigo text-accent-indigo",
        destructive: "border-destructive text-destructive",
        muted: "border-border text-muted-foreground",
      },
      /** Figma "Chip" component's "Subtle" type (Task Hub priority chip, 1039:48730): a tinted fill
       * instead of the default plain card background. One `subtle` boolean instead of doubling every
       * `variant` value, since only the fill changes. */
      subtle: {
        true: "",
        false: "bg-card",
      },
    },
    compoundVariants: [
      { variant: "primary", subtle: true, class: "bg-primary/15" },
      { variant: "info", subtle: true, class: "bg-info/15" },
      { variant: "warning", subtle: true, class: "bg-warning/15" },
      { variant: "teal", subtle: true, class: "bg-accent-teal/15" },
      { variant: "purple", subtle: true, class: "bg-accent-purple/15" },
      { variant: "indigo", subtle: true, class: "bg-accent-indigo/15" },
      { variant: "destructive", subtle: true, class: "bg-destructive/15" },
      { variant: "muted", subtle: true, class: "bg-muted" },
    ],
    defaultVariants: { variant: "muted", subtle: false },
  },
);

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof chipVariants> {}

export function Chip({ className, variant, subtle, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ variant, subtle }), className)} {...props} />;
}

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Outline status pill — Figma "Chip" component (Cattle table status/health columns): white/card
 * fill, a colored border, bold colored text. Distinct from `Badge` (solid tint fill), which stays
 * the app's default for profile-card/detail-header status display. */
const chipVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full border bg-card px-3 py-1 text-xs font-bold",
  {
    variants: {
      variant: {
        primary: "border-primary text-primary",
        info: "border-info text-info",
        warning: "border-warning text-warning",
        teal: "border-accent-teal text-accent-teal",
        destructive: "border-destructive text-destructive",
        muted: "border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "muted" },
  },
);

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof chipVariants> {}

export function Chip({ className, variant, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ variant }), className)} {...props} />;
}

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/**
 * Canonical button per rakhal-ui-analysis.md §6.4:
 * primary = solid green · secondary = white bg + green border/text (the mock's "Cancel") ·
 * destructive = white bg + red border/text (mock never shows solid red) · ghost = borderless.
 *
 * `primary` uses a literal white label rather than `text-primary-foreground` (`--primary-foreground`
 * is a dark near-black, chosen elsewhere purely for WCAG contrast on lighter tints like badges/
 * checkboxes) — every primary-button mock in Figma shows a white label on the solid green fill, and
 * scoping the override to just this variant avoids touching the shared token's other consumers.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-hover",
        secondary: "border border-primary bg-card text-primary hover:bg-success-tint",
        destructive: "border border-destructive bg-card text-destructive hover:bg-destructive-tint",
        outline: "border border-border bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        /** For dark/green hero surfaces (landing, upgrade card): translucent white. */
        inverse: "border border-sidebar-foreground/30 bg-sidebar-foreground/10 text-sidebar-foreground hover:bg-sidebar-foreground/20",
      },
      size: {
        sm: "h-9 px-3 pointer-coarse:h-11",
        md: "h-11 px-5",
        lg: "h-12 px-7 text-base",
        icon: "size-10 pointer-coarse:size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. a next/link) instead of a <button>. */
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };

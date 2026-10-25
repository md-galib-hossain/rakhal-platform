"use client"; // corner checkbox over a grid card

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

/** Thin corner-checkbox wrapper for the bulk-action dock (2026-07-21) — factored out of
 * `features/feed/components/concentration-card.tsx`'s ad-hoc inline checkbox so Inventory's grid
 * cards (Medicine/Equipment/Feed Item/Feed Stock) don't each reimplement it. Wraps the *whole*
 * card rather than just its image: every one of those cards' own overlays (row-actions "⋯", type
 * chips, delete buttons) are positioned relative to the card's *inner* image `div`, not this outer
 * wrapper, so anchoring the checkbox to the outer corner here can never collide with them. Renders
 * children unchanged when `canSelect` is false (no permission, or bulk-select not wired up here). */
export function SelectableCardOverlay({
  selected,
  onToggleSelect,
  canSelect,
  label,
  className,
  children,
}: {
  selected: boolean;
  onToggleSelect: () => void;
  canSelect: boolean;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!canSelect) return <>{children}</>;
  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      <div className="absolute left-1.5 top-1.5 z-20">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect()}
          aria-label={label}
          className="border-2 bg-card/90 shadow-sm"
        />
      </div>
      {children}
    </div>
  );
}

"use client"; // corner select toggle over a grid card

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Selection wrapper for the bulk-action dock's grid cards. The wrapper is the positioning context
 * (card overlays such as row-action "⋯" or chips live inside the card's own image block), so the
 * toggle sits on the card's outer corner. `position` lets a card with chips in the top-left (Animals)
 * move it to the top-right.
 *
 * Look: unselected = a quiet round outline that only shows on hover/focus (always visible on touch
 * devices, where there is no hover); selected = filled primary check + a primary ring around the whole
 * card, so a multi-selection reads at a glance instead of as a field of boxes. Renders children
 * unchanged when `canSelect` is false. */
export function SelectableCardOverlay({
  selected,
  onToggleSelect,
  canSelect,
  label,
  className,
  position = "top-left",
  children,
}: {
  selected: boolean;
  onToggleSelect: () => void;
  canSelect: boolean;
  label: string;
  className?: string;
  position?: "top-left" | "top-right";
  children: React.ReactNode;
}) {
  if (!canSelect) return <>{children}</>;
  return (
    <div
      className={cn(
        "group/select relative flex h-full flex-col rounded-2xl transition-shadow",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={label}
        onClick={onToggleSelect}
        className={cn(
          "absolute z-20 flex size-7 items-center justify-center rounded-full border-2 shadow-sm transition-all",
          "focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          position === "top-left" ? "left-2 top-2" : "right-2 top-2",
          selected
            ? "border-primary bg-primary text-primary-foreground opacity-100"
            : "border-white/90 bg-black/30 text-transparent opacity-0 backdrop-blur-sm hover:bg-black/50 group-hover/select:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        <Check className="size-4" strokeWidth={3} aria-hidden />
      </button>
      {children}
    </div>
  );
}

"use client"; // AnimalLink opens the global cattle-detail modal

import { AnimalLink } from "@/components/shared/animal-link";
import { cn } from "@/lib/utils";
import { avatarTint } from "@/features/cattle/avatar-tint";

/**
 * Standard cow identity presentation matching Cattle and Health modules:
 * - Deterministic, pleasant avatar background tint from `avatarTint(cattleId)`
 * - Bold initial glyph
 * - Clean name + tag number hierarchy with hover states
 */
export function ReproductionCowIdentity({
  cattleId,
  name,
  tag,
  className,
}: {
  cattleId: string;
  name: string | null;
  tag: string;
  className?: string;
}) {
  const initial = (name ?? tag).charAt(0).toUpperCase();

  return (
    <AnimalLink
      id={cattleId}
      animalName={name}
      tagNumber={tag}
      className={cn("group inline-flex min-w-0 items-center gap-3 text-left font-normal hover:no-underline", className)}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-transform group-hover:scale-105",
          avatarTint(cattleId),
        )}
      >
        {initial}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {name ?? tag}
        </span>
        {name ? <span className="truncate text-xs text-muted-foreground">{tag}</span> : null}
      </span>
    </AnimalLink>
  );
}

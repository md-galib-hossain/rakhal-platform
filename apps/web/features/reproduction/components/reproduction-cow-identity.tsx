"use client"; // AnimalLink opens the global cattle-detail modal

import { AnimalLink } from "@/components/shared/animal-link";
import { cn } from "@/lib/utils";

/** Initials avatar + name/tag stack used by every cow row on the Reproduction page (attention list,
 * forecast, cow list) so a cow always looks the same. Truncates instead of wrapping so a long name
 * never pushes its row's actions off-screen. */
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
  const initials = (name ?? tag).replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase();
  return (
    <AnimalLink
      id={cattleId}
      animalName={name}
      tagNumber={tag}
      className={cn("group flex min-w-0 items-center gap-3 text-left font-normal hover:no-underline", className)}
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground group-hover:underline">{name ?? tag}</span>
        {name ? <span className="truncate text-xs text-muted-foreground">{tag}</span> : null}
      </span>
    </AnimalLink>
  );
}

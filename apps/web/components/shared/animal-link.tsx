"use client";

import { useCattleDetailModal } from "@/features/cattle/context/cattle-detail-modal-context";
import { cn } from "@/lib/utils";

export interface AnimalLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  id: string;
  animalName?: string | null;
  tagNumber?: string | null;
  showTag?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Clickable inline animal name / tag that triggers the global CattleDetailSheet modal.
 */
export function AnimalLink({
  id,
  animalName,
  tagNumber,
  showTag = false,
  className,
  children,
  onClick,
  ...props
}: AnimalLinkProps) {
  const { openCattleDetail } = useCattleDetailModal();

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    openCattleDetail(id);
    onClick?.(e);
  }

  const label = children ?? (
    <>
      <span>{animalName ?? tagNumber}</span>
      {showTag && animalName && tagNumber && (
        <span className="ml-1 text-xs text-muted-foreground">({tagNumber})</span>
      )}
    </>
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "cursor-pointer text-left font-medium transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {label}
    </button>
  );
}

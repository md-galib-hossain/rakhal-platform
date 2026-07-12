"use client"; // page-jump select

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ELLIPSIS = "…" as const;
type PaginationItem = number | typeof ELLIPSIS;

/** Classic windowed page list: always shows the first/last page plus `siblingCount` pages either
 * side of the current one, collapsing the rest into a single ellipsis per side. `siblingCount=0`
 * (the default) reproduces the Figma "Cattle" table footer exactly: `1 2 3 … 100` on page 1. */
function getPaginationItems(page: number, totalPages: number, siblingCount: number): PaginationItem[] {
  const totalVisible = siblingCount * 2 + 5; // first + last + current + 2 ellipses
  if (totalVisible >= totalPages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, totalPages);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + siblingCount * 2;
    return [...Array.from({ length: leftItemCount }, (_, i) => i + 1), ELLIPSIS, totalPages];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + siblingCount * 2;
    const start = totalPages - rightItemCount + 1;
    return [1, ELLIPSIS, ...Array.from({ length: rightItemCount }, (_, i) => start + i)];
  }
  return [
    1,
    ELLIPSIS,
    ...Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i),
    ELLIPSIS,
    totalPages,
  ];
}

export interface PaginationProps {
  /** 1-indexed current page. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Pages shown either side of the current page before collapsing into `…`. Default 0 (Figma spec). */
  siblingCount?: number;
  disabled?: boolean;
  className?: string;
}

/** Reusable numbered pagination — pixel-matched to the Figma "Pagination" component (Cattle table
 * footer): prev/next 28px icon buttons, 32×28px page pills (active = primary fill), a `Page [N] of
 * [total]` jump select on the right. Purely presentational — callers own how `page` maps to data. */
export function Pagination({ page, totalPages, onPageChange, siblingCount = 0, disabled, className }: PaginationProps) {
  if (totalPages < 1) return null;
  const items = getPaginationItems(page, totalPages, siblingCount);
  const clampedChange = (next: number) => {
    if (next < 1 || next > totalPages || next === page) return;
    onPageChange(next);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-7 rounded-sm"
          disabled={disabled || page <= 1}
          onClick={() => clampedChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>

        <div className="flex items-center gap-1">
          {items.map((item, i) =>
            item === ELLIPSIS ? (
              <div key={`ellipsis-${i}`} className="flex h-8 w-6 items-end justify-center">
                <MoreHorizontal className="size-4 text-muted-foreground" aria-hidden />
              </div>
            ) : (
              <button
                key={item}
                type="button"
                disabled={disabled}
                aria-current={item === page ? "page" : undefined}
                onClick={() => clampedChange(item)}
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded-sm text-xs font-medium transition-colors",
                  item === page
                    ? "border-[1.5px] border-primary-hover bg-primary text-white font-bold"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted disabled:pointer-events-none",
                )}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="size-7 rounded-sm"
          disabled={disabled || page >= totalPages}
          onClick={() => clampedChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">Page</p>
        <Select
          value={String(page)}
          onValueChange={(v) => clampedChange(Number(v))}
          disabled={disabled || totalPages <= 1}
        >
          <SelectTrigger className="h-7 w-auto gap-1 rounded-sm border-border px-2 py-1 text-sm font-medium text-foreground shadow-none">
            <SelectValue>{page}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground whitespace-nowrap">of {totalPages}</p>
      </div>
    </div>
  );
}

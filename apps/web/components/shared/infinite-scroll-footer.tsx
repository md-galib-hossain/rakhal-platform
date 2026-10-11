"use client"; // IntersectionObserver sentinel + live-region status

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface InfiniteScrollFooterProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** A failure while appending a page. Auto-loading stops until the user presses Retry. */
  isError?: boolean;
  onLoadMore: () => void;
  /** Rows currently loaded; the end-of-list note only shows when there are some. */
  loadedCount?: number;
  /** Scroll container to observe against. Omit for the viewport (page scroll). */
  rootRef?: React.RefObject<Element | null>;
  /** Start loading this far before the sentinel reaches the edge. */
  rootMargin?: string;
  className?: string;
}

/**
 * Shared bottom-of-list trigger for append-forever lists. An `IntersectionObserver` sentinel
 * fires `onLoadMore` before the user reaches the end; a real "Load more" button (same handler) is
 * always rendered while more rows exist, so keyboard / switch users and failed auto-loads never
 * depend on scrolling. The observer is torn down while a fetch is in flight or after an error, and
 * re-created afterwards — if the sentinel is still visible it fires once more, which is exactly the
 * "fill a tall viewport" behaviour, and it can never run away because it stops at `hasNextPage=false`.
 * Status text lives in one polite live region (never per-row announcements).
 */
export function InfiniteScrollFooter({
  hasNextPage,
  isFetchingNextPage,
  isError = false,
  onLoadMore,
  loadedCount = 0,
  rootRef,
  rootMargin = "400px",
  className,
}: InfiniteScrollFooterProps) {
  const t = useTranslations("common.infiniteScroll");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  });

  const armed = hasNextPage && !isFetchingNextPage && !isError;

  useEffect(() => {
    const target = sentinelRef.current;
    if (!armed || !target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreRef.current();
      },
      { root: rootRef?.current ?? null, rootMargin },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [armed, rootRef, rootMargin]);

  const status = isFetchingNextPage
    ? t("loading")
    : isError
      ? t("error")
      : !hasNextPage && loadedCount > 0
        ? t("end", { count: loadedCount })
        : "";

  return (
    <div className={cn("flex flex-col items-center gap-2 py-2", className)}>
      <div ref={sentinelRef} aria-hidden className="h-px w-full shrink-0" />
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
        {isFetchingNextPage ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {status}
      </p>
      {hasNextPage && !isFetchingNextPage ? (
        <Button variant="outline" size="sm" onClick={onLoadMore}>
          {isError ? t("retry") : t("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

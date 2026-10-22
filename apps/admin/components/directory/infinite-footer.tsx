"use client"; // IntersectionObserver sentinel + live-region status

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";

/**
 * Bottom-of-list trigger, same behaviour as the consumer app's footer: an IntersectionObserver sentinel
 * loads the next page before the end is reached, a real "Load more" button covers keyboard users and failed
 * loads, and one polite live region carries the status.
 */
export function InfiniteFooter({
  hasNextPage,
  isFetchingNextPage,
  isError,
  onLoadMore,
  loadedCount,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  onLoadMore: () => void;
  loadedCount: number;
}) {
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
      { rootMargin: "400px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [armed]);

  const status = isFetchingNextPage
    ? "Loading more..."
    : isError
      ? "Could not load more."
      : !hasNextPage && loadedCount > 0
        ? `All ${loadedCount} loaded`
        : "";

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div ref={sentinelRef} aria-hidden className="h-px w-full shrink-0" />
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
        {isFetchingNextPage ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {status}
      </p>
      {hasNextPage && !isFetchingNextPage ? (
        <Button variant="outline" size="sm" onClick={onLoadMore}>
          {isError ? "Retry" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}

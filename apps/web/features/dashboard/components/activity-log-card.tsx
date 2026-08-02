"use client"; // infinite query + IntersectionObserver-driven pagination

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { History, Loader2 } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { cn } from "@/lib/utils";
import { activityApi } from "@/features/activity/api";
import { MODULE_STYLE } from "@/features/activity/module-style";
import type { ActivityLogEntry } from "@/features/activity/types";
import { DashboardCard } from "./dashboard-card";

const PAGE_SIZE = 15;

/**
 * Dashboard-preview variant of the `/activity` page's list — same cursor endpoint
 * (`activityApi.list` → `GET /activity-log`), but accumulated via `useInfiniteQuery` instead of
 * `useCursorPager` (that hook is a numbered-page adapter, not an append-forever one) and paged by
 * an `IntersectionObserver` sentinel at the bottom of the card's own scroll container, per the
 * architecture the ticket asked for: cursor query (LIMIT-bounded) → `{items, meta}` → accumulate
 * pages → observer loads the next page near the bottom. No virtualizer — the card's fixed height
 * and modest page size keep the DOM small without one.
 */
function useActivityInfiniteList() {
  return useInfiniteQuery({
    queryKey: ["dashboard", "activity-log", "infinite"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => activityApi.list({}, pageParam, PAGE_SIZE),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? (lastPage.meta.endCursor ?? undefined) : undefined),
    staleTime: 30_000,
  });
}

export function ActivityLogCard() {
  const t = useTranslations("dashboard.activityLog");
  const query = useActivityInfiniteList();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = sentinelRef.current;
    const root = scrollRef.current;
    if (!target || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      },
      { root, threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.hasNextPage, query.isFetchingNextPage]);

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <DashboardCard
      title={t("title")}
      headerRight={
        <Link href="/activity" className="text-xs font-medium text-primary hover:underline">
          {t("viewAll")}
        </Link>
      }
    >
      {query.isLoading ? (
        <CardSkeleton lines={4} />
      ) : query.isError ? (
        <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={History} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <div ref={scrollRef} className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
          {items.map((entry) => (
            <ActivityLogRow key={entry.id} entry={entry} />
          ))}
          <div ref={sentinelRef} aria-hidden className="h-px shrink-0" />
          {query.isFetchingNextPage ? (
            <div className="flex justify-center py-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : null}
        </div>
      )}
    </DashboardCard>
  );
}

function ActivityLogRow({ entry }: { entry: ActivityLogEntry }) {
  const style = MODULE_STYLE[entry.module];
  const Icon = style.icon;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-2.5">
      <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", style.iconBg)}>
        <Icon className={cn("size-4", style.iconFg)} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-foreground">{entry.eventTitle}</p>
        <p className="truncate text-xs text-muted-foreground">{entry.actor.name}</p>
      </div>
      <DateText
        date={entry.timestamp}
        options={{ hour: "numeric", minute: "2-digit" }}
        className="shrink-0 text-xs text-muted-foreground"
      />
    </div>
  );
}

"use client"; // list query, URL filters, polling

import Link from "next/link";
import { useTranslations } from "next-intl";
import { FileText, SearchX } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useReportsInfinite } from "@/features/reports";
import { ReportsHistoryFilters, useReportFilters } from "./reports-history-filters";
import { ReportsHistoryList } from "./reports-history-list";
import { useReportsListPolling } from "./use-reports-list-polling";

export interface ReportsHistoryProps {
  canRetry: boolean;
  canDelete: boolean;
  /** Offer "New report" in the empty state (permission AND plan). */
  canStartNew: boolean;
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Report history: filters (URL), cursor infinite list, live refresh while anything is generating.
 * States: loading skeleton, error + retry, empty (never created / no match for the filters), success.
 */
export function ReportsHistory({ canRetry, canDelete, canStartNew }: ReportsHistoryProps) {
  const tl = useTranslations("reportsLanding");
  const { filters, active, setParams, clear } = useReportFilters();
  const query = useReportsInfinite(filters);

  useReportsListPolling(query.items, query.refetch);

  let body: React.ReactNode;
  if (query.isError) {
    body = (
      <ErrorState
        title={tl("history.error.title")}
        description={tl("history.error.description")}
        className="py-10"
      />
    );
  } else if (query.isLoading) {
    body = <HistorySkeleton />;
  } else if (query.items.length === 0) {
    body = active ? (
      <EmptyState
        icon={SearchX}
        title={tl("history.noMatch.title")}
        description={tl("history.noMatch.description")}
        className="py-10"
        action={
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            {tl("filters.clear")}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={FileText}
        title={tl("history.empty.title")}
        description={tl("history.empty.description")}
        className="py-10"
        action={
          canStartNew ? (
            <Button asChild size="sm">
              <Link href="/reports/new">{tl("newReport")}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <>
        <ReportsHistoryList items={query.items} canRetry={canRetry} canDelete={canDelete} />
        <InfiniteScrollFooter
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          isError={query.isNextPageError}
          onLoadMore={query.fetchNextPage}
          loadedCount={query.items.length}
        />
      </>
    );
  }

  return (
    <section aria-labelledby="reports-history-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 id="reports-history-title" className="text-lg font-semibold text-foreground">
          {tl("history.title")}
        </h2>
        <ReportsHistoryFilters filters={filters} active={active} onChange={(next) => void setParams(next)} onClear={clear} />
      </div>
      {query.isError ? (
        <div className="flex flex-col items-center gap-2">
          {body}
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {tl("retry")}
          </Button>
        </div>
      ) : (
        body
      )}
    </section>
  );
}

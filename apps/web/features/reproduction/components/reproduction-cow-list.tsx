"use client"; // status filter state + live cursor query + responsive layout

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useInfiniteCursorList } from "@/lib/hooks/use-infinite-cursor-list";
import { qk } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { reproductionApi } from "../api";
import type { ReproductionCowRow, ReproductiveStatus } from "../types";
import { ReproductionCard } from "./reproduction-card";
import { ReproductionCowIdentity } from "./reproduction-cow-identity";

const STATUS_VARIANT: Record<ReproductiveStatus, ChipProps["variant"]> = {
  NOT_ELIGIBLE: "muted",
  POSTPARTUM_WAITING: "muted",
  OPEN: "warning",
  BRED_AWAITING_CONFIRMATION: "info",
  PREGNANT: "teal",
};

/** Only the three statuses `GET /reproduction/cows` returns in the active cycle. */
const STATUS_FILTERS: (ReproductiveStatus | undefined)[] = [
  undefined,
  "OPEN",
  "BRED_AWAITING_CONFIRMATION",
  "PREGNANT",
];

/** Typical bovine gestation (days). */
const GESTATION_DAYS = 283;

/** Rows fetched per page. */
const COW_PAGE_SIZE = 20;

/** Days open operational thresholds. */
const DAYS_OPEN_WARN = 120;
const DAYS_OPEN_DANGER = 180;

/**
 * Reproduction Cow List:
 * - Segmented status tabs in the card header for a polished, cohesive feel
 * - Scannable tabular format on desktop with zebra/hover interaction
 * - Mobile card view below @3xl container query
 */
export function ReproductionCowList() {
  const t = useTranslations("reproduction.cowList");
  const [status, setStatus] = useState<ReproductiveStatus | undefined>(undefined);

  const pager = useInfiniteCursorList(
    qk.reproduction.cows(status),
    (cursor, limit) => reproductionApi.reproductionCows(status, cursor, limit),
    { pageSize: COW_PAGE_SIZE, getId: (row) => row.cattle_id },
  );
  const rows = pager.items;

  const headerFilter = (
    <Tabs
      value={status ?? "all"}
      onValueChange={(v) => setStatus(v === "all" ? undefined : (v as ReproductiveStatus))}
    >
      <TabsList aria-label={t("filterLabel")}>
        {STATUS_FILTERS.map((value) => (
          <TabsTrigger key={value ?? "all"} value={value ?? "all"}>
            {value ? t(`statusValues.${value}`) : t("filterAll")}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <ReproductionCard title={t("title")} headerRight={headerFilter}>
      {pager.isLoading ? (
        <div className="flex flex-col gap-3 py-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : pager.isError ? (
        <ErrorState onRetry={() => void pager.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("empty")} className="py-12" />
      ) : (
        <>
          <div className="hidden @3xl:block">
            <CowTable rows={rows} />
          </div>
          <ul className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @3xl:hidden">
            {rows.map((row) => (
              <CowCard key={row.cattle_id} row={row} />
            ))}
          </ul>
          <InfiniteScrollFooter
            hasNextPage={pager.hasNextPage}
            isFetchingNextPage={pager.isFetchingNextPage}
            isError={pager.isNextPageError}
            onLoadMore={pager.fetchNextPage}
            loadedCount={rows.length}
          />
        </>
      )}
    </ReproductionCard>
  );
}

function StatusChip({ status }: { status: ReproductiveStatus | null }) {
  const t = useTranslations("reproduction.cowList");
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <Chip variant={STATUS_VARIANT[status]} subtle className="px-2.5 py-0.5 text-xs">
      {t(`statusValues.${status}`)}
    </Chip>
  );
}

function CheckChip({ row }: { row: ReproductionCowRow }) {
  const t = useTranslations("reproduction.cowList");
  if (row.pregnancy_checked)
    return (
      <Chip variant="teal" subtle className="px-2.5 py-0.5 text-xs">
        {t("checkDone")}
      </Chip>
    );
  if (row.status === "BRED_AWAITING_CONFIRMATION")
    return (
      <Chip variant="warning" subtle className="px-2.5 py-0.5 text-xs">
        {t("checkPending")}
      </Chip>
    );
  return <span className="text-muted-foreground">—</span>;
}

function GestationBar({ days }: { days: number }) {
  const t = useTranslations("reproduction.cowList");
  const pct = Math.max(0, Math.min(100, Math.round((days / GESTATION_DAYS) * 100)));
  return (
    <div className="flex min-w-28 items-center gap-2">
      <span className="text-sm font-medium text-foreground tabular-nums">{days}d</span>
      <div
        role="progressbar"
        aria-label={t("columns.daysPregnant")}
        aria-valuemin={0}
        aria-valuemax={GESTATION_DAYS}
        aria-valuenow={Math.min(days, GESTATION_DAYS)}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-accent-teal transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DaysOpenCell({ days }: { days: number | null }) {
  if (days == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "font-semibold tabular-nums text-sm",
        days >= DAYS_OPEN_DANGER
          ? "text-destructive"
          : days >= DAYS_OPEN_WARN
            ? "text-warning"
            : "text-foreground",
      )}
    >
      {days}
    </span>
  );
}

function CowTable({ rows }: { rows: ReproductionCowRow[] }) {
  const t = useTranslations("reproduction.cowList");
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="py-3 font-semibold text-foreground">{t("columns.cow")}</TableHead>
            <TableHead className="py-3 font-semibold text-foreground">{t("columns.status")}</TableHead>
            <TableHead className="py-3 font-semibold text-foreground">{t("columns.lastAiDate")}</TableHead>
            <TableHead className="py-3 font-semibold text-foreground">{t("columns.pregnancyChecked")}</TableHead>
            <TableHead className="py-3 font-semibold text-foreground">{t("columns.daysOpen")}</TableHead>
            <TableHead className="py-3 font-semibold text-foreground">{t("columns.daysPregnant")}</TableHead>
            <TableHead className="py-3 font-semibold text-foreground">{t("columns.expectedCalvingDate")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.cattle_id} className="transition-colors hover:bg-muted/30">
              <TableCell className="py-3.5">
                <ReproductionCowIdentity cattleId={row.cattle_id} name={row.name} tag={row.tag} />
              </TableCell>
              <TableCell className="py-3.5">
                <StatusChip status={row.status} />
              </TableCell>
              <TableCell className="py-3.5 text-sm text-muted-foreground">
                {row.last_ai_date ? <DateText date={row.last_ai_date} /> : "—"}
              </TableCell>
              <TableCell className="py-3.5">
                <CheckChip row={row} />
              </TableCell>
              <TableCell className="py-3.5">
                <DaysOpenCell days={row.days_open} />
              </TableCell>
              <TableCell className="py-3.5">
                {row.days_pregnant != null ? <GestationBar days={row.days_pregnant} /> : "—"}
              </TableCell>
              <TableCell className="py-3.5">
                {row.expected_calving_date ? (
                  <ExpectedCalving date={row.expected_calving_date} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function daysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

function ExpectedCalving({ date }: { date: string }) {
  const t = useTranslations("reproduction.cowList");
  const days = daysUntil(date);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5 text-sm">
      <DateText date={date} />
      <span className={cn("text-xs font-medium tabular-nums", days < 0 ? "text-destructive" : "text-muted-foreground")}>
        (
        {days < 0
          ? t("overdueDays", { count: -days })
          : days === 0
            ? t("dueToday")
            : t("daysLeft", { count: days })}
        )
      </span>
    </span>
  );
}

function CowCard({ row }: { row: ReproductionCowRow }) {
  const t = useTranslations("reproduction.cowList");
  const showCheck = row.pregnancy_checked || row.status === "BRED_AWAITING_CONFIRMATION";
  const daysOpenUrgent =
    row.days_open != null && row.days_open >= DAYS_OPEN_WARN && row.status === "OPEN";

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-3.5 transition-colors",
        daysOpenUrgent
          ? row.days_open! >= DAYS_OPEN_DANGER
            ? "border-destructive/30 bg-destructive-tint/20"
            : "border-warning/30 bg-warning-tint/20"
          : "border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <ReproductionCowIdentity
          cattleId={row.cattle_id}
          name={row.name}
          tag={row.tag}
          className="flex-1 basis-40"
        />
        <StatusChip status={row.status} />
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-x-4 gap-y-2.5 text-sm">
        {row.last_ai_date ? (
          <Fact label={t("columns.lastAiDate")}>
            <DateText date={row.last_ai_date} />
          </Fact>
        ) : null}
        {row.days_open != null ? (
          <Fact label={t("columns.daysOpen")}>
            <DaysOpenCell days={row.days_open} />
          </Fact>
        ) : null}
        {row.days_pregnant != null ? (
          <Fact label={t("columns.daysPregnant")}>
            <GestationBar days={row.days_pregnant} />
          </Fact>
        ) : null}
        {row.expected_calving_date ? (
          <Fact label={t("columns.expectedCalvingDate")}>
            <ExpectedCalving date={row.expected_calving_date} />
          </Fact>
        ) : null}
        {showCheck ? (
          <Fact label={t("columns.pregnancyChecked")}>
            <CheckChip row={row} />
          </Fact>
        ) : null}
      </dl>
    </li>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  );
}

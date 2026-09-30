"use client"; // status filter state + live cursor query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Pagination } from "@/components/shared/pagination";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
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

/** Filter chips — `undefined` is "all". Only the three statuses `GET /reproduction/cows` returns. */
const STATUS_FILTERS: (ReproductiveStatus | undefined)[] = [undefined, "OPEN", "BRED_AWAITING_CONFIRMATION", "PREGNANT"];

/** Typical bovine gestation, used only to scale the progress bar (not shown as a number). */
const GESTATION_DAYS = 283;

/** Rows per page — 10 by default; the table is the page's one full-width list so it can hold more. */
const COW_PAGE_SIZES = [10, 20, 50, 100] as const;

/** RAKHAL-363 — every cow currently in an active reproductive cycle (Open/Inseminated/Pregnant),
 * real numbered pages over the keyset cursor (`GET /reproduction/cows`, `reproduction.service.ts`'s
 * `listReproductionCows`). Status chips filter server-side via the endpoint's `status` param.
 *
 * Responsive by the card's own width (container query), not the viewport: a real table from `@3xl`
 * (48rem), a stack of self-contained cow cards below it — so the 7-column table never has to
 * side-scroll on a phone, and a half-width layout on a tablet gets the cards it needs. */
export function ReproductionCowList() {
  const t = useTranslations("reproduction.cowList");
  const [status, setStatus] = useState<ReproductiveStatus | undefined>(undefined);
  // Numbered pages over the endpoint's keyset cursor (same adapter as the events feed); the pager resets to
  // page 1 when the status chip or the page size changes. Prefix matches the cow-list invalidation.
  const pager = useCursorPager(
    qk.reproduction.cows(status),
    (cursor, limit) => reproductionApi.reproductionCows(status, cursor, limit),
    { initialPageSize: COW_PAGE_SIZES[0] },
  );
  const rows = pager.items;

  return (
    <ReproductionCard title={t("title")}>
      <div role="group" aria-label={t("filterLabel")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STATUS_FILTERS.map((value) => {
          const active = value === status;
          return (
            <button
              key={value ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(value)}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {value ? t(`statusValues.${value}`) : t("filterAll")}
            </button>
          );
        })}
      </div>

      {pager.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : pager.isError ? (
        <ErrorState onRetry={() => void pager.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("empty")} className="py-8" />
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
          <Pagination
            page={pager.page}
            totalPages={pager.totalPages}
            onPageChange={pager.goToPage}
            isFetching={pager.isFetching}
            pageSize={pager.pageSize}
            onPageSizeChange={pager.setPageSize}
            pageSizeOptions={COW_PAGE_SIZES}
          />
        </>
      )}
    </ReproductionCard>
  );
}

function StatusChip({ status }: { status: ReproductiveStatus | null }) {
  const t = useTranslations("reproduction.cowList");
  if (!status) return <span className="text-muted-foreground">—</span>;
  return <Chip variant={STATUS_VARIANT[status]}>{t(`statusValues.${status}`)}</Chip>;
}

/** A bare Yes/No under "Checked" was ambiguous (checked what?) and flagged an Open cow as "No"
 * though nothing awaits a check — only an inseminated, unchecked cow is "Pending". */
function CheckChip({ row }: { row: ReproductionCowRow }) {
  const t = useTranslations("reproduction.cowList");
  if (row.pregnancy_checked) return <Chip variant="teal">{t("checkDone")}</Chip>;
  if (row.status === "BRED_AWAITING_CONFIRMATION") return <Chip variant="warning">{t("checkPending")}</Chip>;
  return <span className="text-muted-foreground">—</span>;
}

function GestationBar({ days }: { days: number }) {
  const t = useTranslations("reproduction.cowList");
  const pct = Math.max(0, Math.min(100, Math.round((days / GESTATION_DAYS) * 100)));
  return (
    <div className="flex min-w-24 items-center gap-2">
      <span className="text-sm font-medium text-foreground tabular-nums">{days}</span>
      <div
        role="progressbar"
        aria-label={t("columns.daysPregnant")}
        aria-valuemin={0}
        aria-valuemax={GESTATION_DAYS}
        aria-valuenow={Math.min(days, GESTATION_DAYS)}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-accent-teal" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CowTable({ rows }: { rows: ReproductionCowRow[] }) {
  const t = useTranslations("reproduction.cowList");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("columns.cow")}</TableHead>
          <TableHead>{t("columns.status")}</TableHead>
          <TableHead>{t("columns.lastAiDate")}</TableHead>
          <TableHead>{t("columns.pregnancyChecked")}</TableHead>
          <TableHead>{t("columns.daysOpen")}</TableHead>
          <TableHead>{t("columns.daysPregnant")}</TableHead>
          <TableHead>{t("columns.expectedCalvingDate")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.cattle_id}>
            <TableCell>
              <ReproductionCowIdentity cattleId={row.cattle_id} name={row.name} tag={row.tag} />
            </TableCell>
            <TableCell>
              <StatusChip status={row.status} />
            </TableCell>
            <TableCell>{row.last_ai_date ? <DateText date={row.last_ai_date} /> : "—"}</TableCell>
            <TableCell>
              <CheckChip row={row} />
            </TableCell>
            <TableCell className="tabular-nums">{row.days_open ?? "—"}</TableCell>
            <TableCell>{row.days_pregnant != null ? <GestationBar days={row.days_pregnant} /> : "—"}</TableCell>
            <TableCell>{row.expected_calving_date ? <DateText date={row.expected_calving_date} /> : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Narrow-container form of one row: identity + status on top, then only the facts this cow actually
 * has (an Open cow has no pregnancy days or due date — showing "—" for them is noise). The facts grid
 * is `auto-fit`, so 2 columns on a phone, 3–4 as the card widens, no breakpoint. */
function CowCard({ row }: { row: ReproductionCowRow }) {
  const t = useTranslations("reproduction.cowList");
  const showCheck = row.pregnancy_checked || row.status === "BRED_AWAITING_CONFIRMATION";
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <ReproductionCowIdentity cattleId={row.cattle_id} name={row.name} tag={row.tag} className="flex-1 basis-40" />
        <StatusChip status={row.status} />
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-x-4 gap-y-2.5 text-sm">
        {row.last_ai_date ? (
          <Fact label={t("columns.lastAiDate")}>
            <DateText date={row.last_ai_date} />
          </Fact>
        ) : null}
        {row.days_open != null ? <Fact label={t("columns.daysOpen")}>{row.days_open}</Fact> : null}
        {row.days_pregnant != null ? (
          <Fact label={t("columns.daysPregnant")}>
            <GestationBar days={row.days_pregnant} />
          </Fact>
        ) : null}
        {row.expected_calving_date ? (
          <Fact label={t("columns.expectedCalvingDate")}>
            <DateText date={row.expected_calving_date} />
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

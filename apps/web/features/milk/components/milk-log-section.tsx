"use client"; // search/shed/date filter state; per-session editing lives in MilkLogTable

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useMilkLogTable } from "../hooks/use-milk";
import { MilkCard } from "./milk-card";
import { MilkExportButton } from "./milk-export-button";
import { MilkImportButton } from "./milk-import-button";
import { ReportExportButton } from "@/features/reports/components/report-export-button";
import { MILK_EXPORT_REPORT } from "@/features/reports/report-defs";
import { MilkLogTable } from "./milk-log-table";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const ALL_SHEDS = "__all__";

/** "Milk Log" (Figma node 734:32468) — a single table with all of the farm's configured sessions
 * as columns (per-cow `morningL`/`noonL`/`eveningL`/`nightL` all come back on one `GET /milk/log`
 * row already), replacing the previous per-session tab switcher. Search and the shed filter run
 * client-side over the day's already-fetched rows — the real `shed`/`tag`/`name` fields, no new
 * endpoint. Figma's "All Group" filter has no backing concept (the backend's `productionStatus` is
 * a hardcoded `'milking'` literal for every row today, not a real group), so it's dropped rather
 * than shipping a filter that never changes anything. */
export function MilkLogSection() {
  const t = useTranslations("milk.log");
  const locale = useLocale() as Locale;
  const [date, setDate] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [shed, setShed] = useState(ALL_SHEDS);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const query = useMilkLogTable(date);

  function requestDateChange(next: string) {
    if (isDirty) {
      setPendingDate(next);
    } else {
      setDate(next);
    }
  }

  const sessions = query.data?.sessionConfig ?? [];
  const shedOptions = useMemo(() => {
    const names = new Set((query.data?.entries ?? []).map((r) => r.shed).filter((s): s is string => !!s));
    return Array.from(names).sort();
  }, [query.data]);
  const entries = query.data?.entries ?? [];

  const headerRight = (
    <div className="flex flex-col items-end gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <MilkImportButton />
        <MilkExportButton cattleOptions={entries} />
        <ReportExportButton report={MILK_EXPORT_REPORT} />

        <Select value={shed} onValueChange={setShed}>
          <SelectTrigger className="h-9 w-[130px] rounded-lg text-xs shadow-xs" aria-label={t("shedLabel")}>
            <SelectValue placeholder={t("shedFilter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SHEDS}>{t("shedFilter")}</SelectItem>
            {shedOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-xs"
            >
              {formatDate(date, locale)}
              <CalendarDays className="size-3.5" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={new Date(date)}
              defaultMonth={new Date(date)}
              onSelect={(next) => {
                if (!next) return;
                requestDateChange(format(next, "yyyy-MM-dd"));
                setCalendarOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  return (
    <MilkCard
      title={t("title")}
      titleExtra={
        <div className="relative w-[260px] shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-9 rounded-lg pl-9 text-sm"
            aria-label={t("searchPlaceholder")}
          />
        </div>
      }
      headerRight={headerRight}
      className="lg:col-span-5"
    >
      {query.isLoading ? (
        <Table>
          <TableBody>
            <TableSkeleton rows={5} columns={7} />
          </TableBody>
        </Table>
      ) : query.isError ? (
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      ) : sessions.length === 0 ? (
        <EmptyState title={t("noSessionsConfigured")} />
      ) : (
        <MilkLogTable
          key={date}
          date={date}
          sessions={sessions}
          entries={entries}
          search={search}
          shed={shed === ALL_SHEDS ? null : shed}
          onDirtyChange={setIsDirty}
        />
      )}
      <ConfirmDialog
        open={pendingDate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDate(null);
        }}
        title={t("discardUnsavedTitle")}
        description={t("discardUnsavedDescription")}
        confirmLabel={t("discardUnsavedConfirm")}
        variant="destructive"
        onConfirm={() => {
          if (pendingDate) setDate(pendingDate);
          setPendingDate(null);
        }}
      />
    </MilkCard>
  );
}

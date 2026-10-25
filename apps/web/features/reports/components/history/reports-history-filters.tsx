"use client"; // URL-synced filter state (nuqs) + selects

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryStates } from "nuqs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  REPORT_ORIGINS,
  REPORT_STATUSES,
  REPORT_TYPES,
  reportOriginKey,
  reportStatusKey,
  reportTypeKey,
  type ReportListFilters,
} from "@/features/reports";

const ALL = "all";

const filterParsers = {
  type: parseAsStringLiteral(REPORT_TYPES),
  origin: parseAsStringLiteral(REPORT_ORIGINS),
  status: parseAsStringLiteral(REPORT_STATUSES),
};

/** `?type=&origin=&status=` in the URL (shareable, survives refresh); `null` params are dropped from the list query. */
export function useReportFilters() {
  const [params, setParams] = useQueryStates(filterParsers);
  const filters: ReportListFilters = {
    type: params.type ?? undefined,
    origin: params.origin ?? undefined,
    status: params.status ?? undefined,
  };
  const active = Boolean(params.type || params.origin || params.status);
  return { filters, active, setParams, clear: () => void setParams({ type: null, origin: null, status: null }) };
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  optionLabel,
  allLabel,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: readonly T[];
  optionLabel: (v: T) => string;
  allLabel: string;
  onChange: (v: T | null) => void;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : (v as T))}>
      <SelectTrigger className="w-full sm:w-[11rem]" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {optionLabel(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ReportsHistoryFilters({
  filters,
  active,
  onChange,
  onClear,
}: {
  filters: ReportListFilters;
  active: boolean;
  onChange: (next: { [K in keyof ReportListFilters]?: ReportListFilters[K] | null }) => void;
  onClear: () => void;
}) {
  const t = useTranslations();
  const tl = useTranslations("reportsLanding");
  return (
    <div role="group" aria-label={tl("filters.label")} className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <FilterSelect
        label={tl("filters.type")}
        allLabel={tl("filters.allTypes")}
        value={filters.type}
        options={REPORT_TYPES}
        optionLabel={(v) => t(reportTypeKey(v))}
        onChange={(v) => onChange({ type: v })}
      />
      <FilterSelect
        label={tl("filters.origin")}
        allLabel={tl("filters.allOrigins")}
        value={filters.origin}
        options={REPORT_ORIGINS}
        optionLabel={(v) => t(reportOriginKey(v))}
        onChange={(v) => onChange({ origin: v })}
      />
      <FilterSelect
        label={tl("filters.status")}
        allLabel={tl("filters.allStatuses")}
        value={filters.status}
        options={REPORT_STATUSES}
        optionLabel={(v) => t(reportStatusKey(v))}
        onChange={(v) => onChange({ status: v })}
      />
      {active ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {tl("filters.clear")}
        </Button>
      ) : null}
    </div>
  );
}

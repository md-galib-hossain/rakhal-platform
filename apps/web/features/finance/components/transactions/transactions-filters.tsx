"use client"; // filter state lives in the parent (TransactionsView) — this is a pure controlled bar

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { usePeriod } from "@/lib/hooks/use-period";
import { NewTransactionMenu } from "./new-transaction-menu";
import { TRANSACTION_TYPE_OPTIONS } from "./types";

const ALL_TYPES = "ALL";
const ALL_STATUSES = "ALL";

export interface TransactionsFiltersBarProps {
  type: string | undefined;
  onTypeChange: (type: string | undefined) => void;
  status: "POSTED" | "REVERSED" | undefined;
  onStatusChange: (status: "POSTED" | "REVERSED" | undefined) => void;
  period: ReturnType<typeof usePeriod>;
}

/** RAKHAL-385 — `All Types ▾` + a Posted/Voided status filter (the AC's plain "Filters" affordance,
 * folded into one bar rather than a separate popover — the only two server-side filters this
 * screen's own columns expose) + `DateRangePicker` + `+ New Transaction`. `type`'s option set is
 * `TRANSACTION_TYPE_OPTIONS` (`types.ts`'s own doc comment covers the mockup-vs-backend granularity
 * gap). */
export function TransactionsFiltersBar({ type, onTypeChange, status, onStatusChange, period }: TransactionsFiltersBarProps) {
  const t = useTranslations("finance.transactionsV2");
  const tPreset = useTranslations("period.presets");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={type ?? ALL_TYPES} onValueChange={(v) => onTypeChange(v === ALL_TYPES ? undefined : v)}>
        <SelectTrigger className="w-[180px]" aria-label={t("filters.typeLabel")}>
          <SelectValue placeholder={t("filters.allTypes")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TYPES}>{t("filters.allTypes")}</SelectItem>
          {TRANSACTION_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`typeOptions.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status ?? ALL_STATUSES} onValueChange={(v) => onStatusChange(v === ALL_STATUSES ? undefined : (v as "POSTED" | "REVERSED"))}>
        <SelectTrigger className="w-[140px]" aria-label={t("filters.statusLabel")}>
          <SelectValue placeholder={t("filters.allStatuses")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>{t("filters.allStatuses")}</SelectItem>
          <SelectItem value="POSTED">{t("statusOptions.POSTED")}</SelectItem>
          <SelectItem value="REVERSED">{t("statusOptions.REVERSED")}</SelectItem>
        </SelectContent>
      </Select>

      <DateRangePicker
        preset={period.preset}
        range={{ from: period.from, to: period.to }}
        label={tPreset(period.preset === "custom" ? "custom" : period.preset)}
        onPresetChange={period.setPreset}
        onRangeChange={period.setRange}
      />

      <div className="ml-auto">
        <NewTransactionMenu />
      </div>
    </div>
  );
}

"use client"; // controlled filter bar — state lives in the parent view

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { usePeriod } from "@/lib/hooks/use-period";
import { PAYABLE_STATUSES, type PayableStatus } from "../types";

const ALL_STATUSES = "ALL";

/** RAKHAL-391 (MILESTONE 22) — the AC's "Filters" affordance: a payment-status filter (the one
 * server-side `?paymentStatus=` both `GET /purchasing/purchases`/`/purchasing/expenses` v2 expose,
 * RAKHAL-375) + the shared `DateRangePicker` (RAKHAL-380), same bar shape
 * `TransactionsFiltersBar` established. Shared by both the Purchases and Expenses tabs. */
export function PurchasingFiltersBar({
  status,
  onStatusChange,
  period,
}: {
  status: PayableStatus | undefined;
  onStatusChange: (status: PayableStatus | undefined) => void;
  period: ReturnType<typeof usePeriod>;
}) {
  const t = useTranslations("purchasing.filters");
  const tPreset = useTranslations("period.presets");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={status ?? ALL_STATUSES} onValueChange={(v) => onStatusChange(v === ALL_STATUSES ? undefined : (v as PayableStatus))}>
        <SelectTrigger className="w-[160px]" aria-label={t("statusLabel")}>
          <SelectValue placeholder={t("allStatuses")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>{t("allStatuses")}</SelectItem>
          {PAYABLE_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`statusOptions.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DateRangePicker
        preset={period.preset}
        range={{ from: period.from, to: period.to }}
        label={tPreset(period.preset === "custom" ? "custom" : period.preset)}
        onPresetChange={period.setPreset}
        onRangeChange={period.setRange}
      />
    </div>
  );
}

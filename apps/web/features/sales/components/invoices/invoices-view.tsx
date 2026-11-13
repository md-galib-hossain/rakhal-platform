"use client"; // status-tab state + search + period state

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@rakhal/ui/ui/input";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { usePeriod } from "@/lib/hooks/use-period";
import { AgingSummaryStrip } from "@/features/finance/components/payments/aging-summary-strip";
import { NewSaleMenu } from "../new-sale-menu";
import { InvoicesTable } from "./invoices-table";
import type { InvoicePaymentStatus } from "../../types";

const STATUS_TABS: { key: string; status: InvoicePaymentStatus | undefined }[] = [
  { key: "all", status: undefined },
  { key: "unpaid", status: "UNPAID" },
  { key: "partial", status: "PARTIALLY_PAID" },
  { key: "paid", status: "PAID" },
];

/** RAKHAL-388 (MILESTONE 22) — Sales → Invoices (`BUSINESS_IA_PRD.md` §5.9). Status tabs `All |
 * Unpaid | Partial | Paid` map to `?paymentStatus=` (`undefined`/`UNPAID`/`PARTIALLY_PAID`/`PAID`)
 * — an `OVERDUE` row surfaces only under `All`, its own Status cell still reads "Overdue" (server-
 * derived, `ReceivableStatus`'s 4th state has no dedicated tab per the AC's literal 4-tab list).
 * Reuses `AgingSummaryStrip` (`kind="RECEIVABLE"`, built for the Receivables screen, RAKHAL-386) as
 * the AC's 4-tile Aging Summary — same underlying `Receivable` aging data, not a second endpoint. */
export function InvoicesView() {
  const t = useTranslations("sales.invoices");
  const tPreset = useTranslations("period.presets");
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<InvoicePaymentStatus | undefined>(undefined);
  // `?invoice=<number>` (a link from Recent Sales) lands here with that invoice already searched for.
  const [search, setSearch] = useState(() => searchParams.get("invoice") ?? "");
  const period = usePeriod("this_month");

  const filters = { paymentStatus: status, q: search || undefined, from: period.from.toISOString(), to: period.to.toISOString() };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium text-foreground">{t("title")}</p>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <NewSaleMenu />
      </div>

      <AgingSummaryStrip kind="RECEIVABLE" />

      <Tabs value={status ?? "all"} onValueChange={(v) => setStatus(STATUS_TABS.find((s) => s.key === v)?.status)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {t(`tabs.${tab.key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-2">
            <Input placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-[200px]" />
            <DateRangePicker
              preset={period.preset}
              range={{ from: period.from, to: period.to }}
              label={tPreset(period.preset === "custom" ? "custom" : period.preset)}
              onPresetChange={period.setPreset}
              onRangeChange={period.setRange}
            />
          </div>
        </div>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            <InvoicesTable filters={{ ...filters, paymentStatus: tab.status }} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

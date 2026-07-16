"use client"; // URL-synced filters via the shared FilterBar

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { FilterBar } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["REVENUE", "INVENTORY", "HEALTHCARE", "OVERHEAD", "DEBT"] as const;

/** Search + category filter (mirrors `MedicineFilters`' anatomy), URL-synced. The Figma "Master
 * Ledger" row (`1039:25099`) labels its dropdown "All Types" and shows an "Export" button — real
 * gaps, flagged not faked: `LedgerQueryDto` has no `type` filter at all (only `category`, the real
 * field filtered here), and there is no `GET /finance/transactions/export` route on the backend
 * despite `PROJECT_PROGRESS.md`'s RFE-035 description mentioning one, so Export renders per Figma
 * but stays disabled rather than silently doing nothing on click. */
export function LedgerFilters() {
  const t = useTranslations("finance.ledger.filters");

  return (
    <FilterBar
      layout="split"
      searchKey="search"
      searchPlaceholder={t("searchPlaceholder")}
      selects={[
        {
          key: "category",
          label: t("category"),
          options: CATEGORIES.map((c) => ({ value: c, label: t(`categoryOptions.${c}`) })),
        },
      ]}
      extra={
        <Button variant="outline" className="gap-1.5" disabled title={t("exportUnavailable")}>
          <Download className="size-4" aria-hidden />
          {t("export")}
        </Button>
      }
    />
  );
}

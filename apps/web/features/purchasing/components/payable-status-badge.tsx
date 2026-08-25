"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import type { PayableStatus, PayableWithDerived } from "../types";

const VARIANT_BY_STATUS: Record<PayableStatus, "warning" | "success" | "destructive"> = {
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
};

/**
 * RAKHAL-359 — inline payable status for a purchase/expense row, cross-referenced from
 * `GET /purchasing/payables` by `purchaseId`/`expenseId` (see `hooks/use-purchasing.ts#usePayables`'s
 * doc comment — no dedicated filter exists on that list route).
 *
 * **"Pay Supplier" links to `/finance/payables`, not a duplicated settlement dialog** — RAKHAL-358
 * (claimed concurrently on this board, `docs/IN_FLIGHT.md`) owns the real payment-allocation UI at
 * that route. This ticket's job is to link there, not rebuild allocation — per the ticket brief's own
 * instruction to coordinate rather than duplicate. The link carries `?payableId=` so that screen can
 * deep-link/highlight the specific payable once it ships; if RAKHAL-358 lands with a different query
 * contract, the link still degrades safely to the plain payables list. See this feature's own
 * `docs/IN_FLIGHT.md` entry for the exact coordination note.
 */
export function PayableStatusBadge({ payable }: { payable: PayableWithDerived | undefined }) {
  const t = useTranslations("purchasing.payableStatus");
  const locale = useLocale() as Locale;

  if (!payable) {
    return <Badge variant="success">{t("paidInFull")}</Badge>;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={VARIANT_BY_STATUS[payable.status]}>{t(`status.${payable.status}`)}</Badge>
      <span className="text-xs text-muted-foreground">{formatMoney(Number(payable.outstanding), locale)}</span>
      <Link href={`/finance/payables?payableId=${payable.id}`} className="text-xs font-medium text-primary hover:underline">
        {t("paySupplier")}
      </Link>
    </div>
  );
}

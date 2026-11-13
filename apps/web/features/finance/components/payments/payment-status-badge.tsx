"use client"; // reads next-intl translations

import { useTranslations } from "next-intl";
import { Chip, type ChipProps } from "@rakhal/ui/ui/chip";
import type { SettlementStatusV2 } from "../../types-v2";

const STATUS_VARIANT: Record<SettlementStatusV2, ChipProps["variant"]> = {
  PAID: "primary",
  PARTIALLY_PAID: "warning",
  UNPAID: "muted",
  OVERDUE: "destructive",
};

/**
 * RAKHAL-358 — thin, pure pass-through of a `Receivable`/`Payable`'s own `status` field
 * (`ReceivableService.getStatus`/`PayableService.getStatus`) into a colored `Chip`. Deliberately
 * accepts only the already-derived `status` string, never the raw `totalAmount`/`outstanding`
 * figures it could be tempted to re-derive a status from — `FINANCE_V2_DESIGN.md` §4.6 ("Payment
 * status is derived, never chosen") means the API is the single source of truth for this value; a
 * component that recomputed it locally could silently drift from the backend's own rule (e.g. the
 * `OVERDUE`-takes-priority-over-`UNPAID` tie-break) the next time that rule changes server-side.
 * See `payment-status-badge.test.tsx` for the test that enforces this — it asserts the badge's
 * rendered label always matches the `status` prop, for every one of the four values, with no
 * amount/date prop available to derive from even if the component wanted to.
 */
export function PaymentStatusBadge({ status, className }: { status: SettlementStatusV2; className?: string }) {
  const t = useTranslations("finance.settlementsV2.statusOptions");
  return (
    <Chip variant={STATUS_VARIANT[status]} className={className}>
      {t(status)}
    </Chip>
  );
}

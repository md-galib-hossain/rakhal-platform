"use client"; // dialog-open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
import { RecordSaleDialog } from "./record-sale-wizard";
import type { RecordSaleInitial } from "../types";

/**
 * RAKHAL-357 — "Record Sale" entry button + the wizard it opens. Gated on `finance.create`
 * rather than `sales.create`: both real routes this ticket's wired flows submit through
 * (`POST /milk/dispatch`, `POST /finance/income`) require `finance.create` server-side
 * (`MilkDispatchController`/`IncomeController`, grepped directly) — `sales.create` only guards
 * `POST /sales` (`SaleController`), the bare-document route this ticket never calls (see
 * `types.ts`'s top doc comment). Money-moving action — this is a real `<Can>` gate, not decorative
 * (`FINANCE_V2_DESIGN.md` §1.4 flags V1 having zero RBAC gating on any finance screen as a real
 * defect this milestone fixes).
 *
 * Mounted on the standalone `/sales` route (`app/(app)/sales/page.tsx`), and reused as-is by
 * RAKHAL-361's domain entry points (Cattle profile "Sell", Milk area "Sell Milk", Inventory item
 * "Sell", Finance's own "Record Sale" quick action) via the `initial`/`label`/`icon`/`buttonProps`
 * overrides below — same trigger + same wizard everywhere, per `FINANCE_V2_DESIGN.md` §4.3's "the
 * domain operation is the natural route, Finance is only a shortcut" principle, rather than each
 * call site re-implementing its own open/close state.
 */
export function RecordSaleTrigger({
  initial,
  label,
  icon: Icon = Plus,
  buttonProps,
}: {
  initial?: RecordSaleInitial;
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  buttonProps?: Partial<ButtonProps>;
}) {
  const t = useTranslations("sales.record");
  const [open, setOpen] = useState(false);

  return (
    <Can I="finance.create">
      <Button variant="primary" className="gap-2" {...buttonProps} onClick={() => setOpen(true)}>
        <Icon className="size-[18px]" aria-hidden />
        {label ?? t("trigger")}
      </Button>
      <RecordSaleDialog open={open} onOpenChange={setOpen} initial={initial} />
    </Can>
  );
}

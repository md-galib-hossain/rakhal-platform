"use client"; // dialog-open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Milk, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/lib/auth/permissions";
import { RecordSaleDialog } from "./record-sale-wizard";
import { SellMilkSheet } from "./sell-milk-sheet";

/**
 * RAKHAL-388 (MILESTONE 22) — "+ New Sale" entry button. Previously a dropdown (Milk · Animal ·
 * Inventory · Manure · Other Income) that pre-selected `RecordSaleDialog`'s Step 1 — but Step 1
 * asks the exact same "what are you recording" question, so the dropdown was a redundant second
 * pick in front of the wizard. Now a single button opens the wizard straight on Step 1.
 *
 * Gated on `sales.create` **or** `finance.create` — the wizard's own 5 submit paths span two
 * permission resources (Milk→`POST /milk/dispatch` and Other Income→`POST /finance/income` both
 * require `finance.create`; Animal/Inventory/Manure require `sales.create`, confirmed against each
 * route's own `@RequirePermission` decorator) — `<Can>` only tests one string, so this reads both
 * via `useCan()` directly rather than hard-coding one and silently hiding the button for a role that
 * only has the other.
 */
export function NewSaleMenu() {
  const t = useTranslations("sales.newSaleMenu");
  const tMilk = useTranslations("sales.sellMilk");
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [milkOpen, setMilkOpen] = useState(false);

  if (!can("sales.create") && !can("finance.create")) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Milk is the everyday sale, so it gets its own one-screen sheet instead of a wizard step. */}
        {can("finance.create") ? (
          <Button size="sm" className="gap-1.5" onClick={() => setMilkOpen(true)}>
            <Milk className="size-4" aria-hidden />
            {tMilk("title")}
          </Button>
        ) : null}
        <Button size="sm" variant={can("finance.create") ? "outline" : "primary"} className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t("trigger")}
        </Button>
      </div>
      <SellMilkSheet open={milkOpen} onOpenChange={setMilkOpen} />
      <RecordSaleDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

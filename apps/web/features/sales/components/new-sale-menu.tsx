"use client"; // dialog-open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/lib/auth/permissions";
import { RecordSaleDialog } from "./record-sale-wizard";

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
  const can = useCan();
  const [open, setOpen] = useState(false);

  if (!can("sales.create") && !can("finance.create")) return null;

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {t("trigger")}
      </Button>
      <RecordSaleDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

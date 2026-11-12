"use client"; // sheet-open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { SellMilkSheet } from "@/features/sales/components/sell-milk-sheet";

/**
 * "Sell Milk" domain entry point, `/milk` page header. Opens the one-screen `SellMilkSheet`
 * (buyer + litres + paid-now/credit — one submit posts the sale, the stock movement, the payment
 * and the Activity Log entry; see that component's doc comment). Placed at the page level, not per
 * milk-log row, since a milk sale draws on the farm's tanks as a whole, not on one log entry.
 * Gated on `finance.create`, the permission `POST /milk/dispatch` requires.
 */
export function SellMilkButton() {
  const t = useTranslations("milk.page");
  const [open, setOpen] = useState(false);
  return (
    <Can I="finance.create">
      <Button variant="primary" className="gap-2" onClick={() => setOpen(true)}>
        <Banknote className="size-[18px]" aria-hidden />
        {t("sellMilk")}
      </Button>
      <SellMilkSheet open={open} onOpenChange={setOpen} />
    </Can>
  );
}

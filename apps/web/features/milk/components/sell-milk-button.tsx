"use client"; // dialog-open state (via RecordSaleTrigger)

import { useTranslations } from "next-intl";
import { Banknote } from "lucide-react";
import { RecordSaleTrigger } from "@/features/sales/components/record-sale-trigger";

/**
 * RAKHAL-361 — "Sell Milk" domain entry point, `/milk` page header. Opens RAKHAL-357's real Record
 * Sale wizard pre-filled to Product Sale → Milk (`initial={{type:"PRODUCT",productSubtype:"MILK"}}`)
 * — the one sale path that is **fully backend-wired** (`POST /milk/dispatch`, RAKHAL-342/343), per
 * `FINANCE_V2_DESIGN.md` §4.3's "the domain operation is the natural route, Finance is only a
 * shortcut" principle. Placed at the page level (not per milk-log row) since a milk sale is a
 * dispatch against the farm's tank as a whole, not tied to one log entry — matches how
 * `features/buyers/**`'s own dispatch flow already works.
 */
export function SellMilkButton() {
  const t = useTranslations("milk.page");
  return (
    <RecordSaleTrigger
      initial={{ type: "PRODUCT", productSubtype: "MILK" }}
      label={t("sellMilk")}
      icon={Banknote}
      buttonProps={{ variant: "primary" }}
    />
  );
}

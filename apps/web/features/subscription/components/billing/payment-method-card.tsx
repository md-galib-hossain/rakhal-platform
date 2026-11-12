"use client";

import { useTranslations } from "next-intl";
import { Smartphone } from "lucide-react";

/**
 * Figma "Payment Method" row (node `1039:51296`) — the mock shows a stored "Visa - 4242" card, but
 * Rakhal's only gateway is **bKash**, which is tokenized per-checkout and stores no card/wallet on
 * file (the backend has no saved-payment-method store — `GET /settings/billing` returns
 * `payment_method: null`). So we render bKash honestly as the checkout method rather than a fake
 * saved card, and drop the mock's "Update" affordance (there's nothing stored to update).
 */
export function PaymentMethodCard() {
  const t = useTranslations("billing");
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-foreground">{t("paymentMethod.title")}</h3>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col">
          <p className="text-sm font-semibold text-foreground">{t("paymentMethod.bkash")}</p>
          <p className="text-xs text-muted-foreground">{t("paymentMethod.description")}</p>
        </div>
      </div>
    </section>
  );
}

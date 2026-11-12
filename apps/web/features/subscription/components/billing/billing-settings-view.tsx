"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Can } from "@/lib/auth/permissions";
import { useSubscription } from "../../hooks/use-subscription";
import { CurrentPlanCard } from "./current-plan-card";
import { InvoiceHistoryTable } from "./invoice-history-table";
import { PaymentMethodCard } from "./payment-method-card";

/** Checkout is behind the Owner-only actions and carries the heaviest deps (react-hook-form + zod
 * resolver) — dynamically imported so it never lands in the Settings route's initial JS. */
const UpgradePlanModal = dynamic(() => import("./upgrade-plan-modal").then((m) => m.UpgradePlanModal), { ssr: false });

/**
 * Settings › Billing & Subscription tab (Figma `1039:51242`): header + Current Plan banner, Invoice
 * History (Owner/Manager `subscription.read`), Payment Method (bKash), and the checkout sheet behind
 * the Owner-only (`subscription.manage`) Upgrade/Manage actions.
 */
export function BillingSettingsView() {
  const t = useTranslations("billing");
  const { data: sub } = useSubscription();
  const [sheet, setSheet] = useState<{ open: boolean; mode: "upgrade" | "manage" }>({ open: false, mode: "upgrade" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-foreground">{t("header.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("header.description")}</p>
      </div>

      <CurrentPlanCard
        onManage={() => setSheet({ open: true, mode: "manage" })}
        onUpgrade={() => setSheet({ open: true, mode: "upgrade" })}
      />

      <Can I="subscription.read">
        <InvoiceHistoryTable />
      </Can>

      <PaymentMethodCard />

      <Can I="subscription.manage">
        <UpgradePlanModal
          open={sheet.open}
          onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
          mode={sheet.mode}
          currentPlanId={sub?.plan_id ?? null}
        />
      </Can>
    </div>
  );
}

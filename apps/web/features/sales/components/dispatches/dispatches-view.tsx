"use client"; // status-tab state + dialog state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { RecordSaleDialog } from "../record-sale-wizard";
import { DispatchSummaryCards } from "./dispatch-summary-cards";
import { DispatchesTable } from "./dispatches-table";
import type { DispatchStatus } from "../../types";

const STATUS_TABS: { key: string; status: DispatchStatus | undefined }[] = [
  { key: "all", status: undefined },
  { key: "pending", status: "PENDING" },
  { key: "delivered", status: "DELIVERED" },
  { key: "cancelled", status: "CANCELLED" },
];

/** RAKHAL-388 (MILESTONE 22) — Sales → Dispatches (`BUSINESS_IA_PRD.md` §5.8). Status tabs `All |
 * Pending | Delivered | Cancelled` map to `?status=` against the derived `DispatchStatus`.
 * `+ New Dispatch` reuses the existing `RecordSaleDialog` pre-selected to Milk — a dispatch **is**
 * a milk sale, so this doesn't duplicate `RecordDispatchDialog` (`features/buyers/**`, out of this
 * ticket's lane and built against the older `GET /milk/dispatch` shape). */
export function DispatchesView() {
  const t = useTranslations("sales.dispatches");
  const [status, setStatus] = useState<DispatchStatus | undefined>(undefined);
  const [newDispatchOpen, setNewDispatchOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium text-foreground">{t("title")}</p>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Can I="finance.create">
          <Button size="sm" className="gap-1.5" onClick={() => setNewDispatchOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t("newDispatchCta")}
          </Button>
        </Can>
      </div>

      <DispatchSummaryCards />

      <Tabs value={status ?? "all"} onValueChange={(v) => setStatus(STATUS_TABS.find((s) => s.key === v)?.status)}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {t(`tabs.${tab.key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            <DispatchesTable filters={{ status: tab.status }} />
          </TabsContent>
        ))}
      </Tabs>

      <RecordSaleDialog
        open={newDispatchOpen}
        onOpenChange={setNewDispatchOpen}
        initial={{ type: "PRODUCT", productSubtype: "MILK" }}
      />
    </div>
  );
}

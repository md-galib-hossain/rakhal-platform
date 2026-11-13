"use client"; // local dialog-open state only

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { DateText } from "@/components/shared/date-text";
import { Button } from "@rakhal/ui/ui/button";
import { Can } from "@/lib/auth/permissions";
import { RecordStarterFeedDialog } from "../dialogs/record-starter-feed-dialog";
import type { CalfDetail } from "../../types";

export function StarterFeedTab({ calfId, data }: { calfId: string; data: CalfDetail }) {
  const t = useTranslations("calves.detail.starterFeed");
  const [open, setOpen] = useState(false);
  const { firstOfferedDate, firstIntakeDate, currentDailyIntakeG } = data.starterFeed;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">{t("firstOffered")}</p>
          <p className="text-sm font-medium text-foreground">
            {firstOfferedDate ? <DateText date={firstOfferedDate} /> : "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">{t("firstIntake")}</p>
          <p className="text-sm font-medium text-foreground">
            {firstIntakeDate ? <DateText date={firstIntakeDate} /> : "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">{t("currentDailyIntake")}</p>
          <p className="text-sm font-medium text-foreground">
            {currentDailyIntakeG != null ? t("grams", { value: currentDailyIntakeG }) : "—"}
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Can I="calf.log-feeding">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t("logStarterFeed")}
          </Button>
        </Can>
      </div>
      <RecordStarterFeedDialog calfId={calfId} open={open} onOpenChange={setOpen} />
    </div>
  );
}

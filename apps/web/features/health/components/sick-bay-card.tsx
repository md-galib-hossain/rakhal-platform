"use client"; // row actions

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Can } from "@/lib/auth/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AnimalLink } from "@/components/shared/animal-link";
import type { HealthCaseListItem } from "../types";
import { ConditionCell, DayCell, NextStepCell, PriorityChip, ProtocolCell, WithdrawalCell } from "./sick-bay-cells";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** One Sick Bay case as a card — what the table row becomes below `md` (RFE-134, EPIC_HEALTH_CENTER D11). Same cells as
 * the table; the animal and the one number that matters (priority, day of illness) lead, then what is being done and
 * what is due, with the case actions at the bottom as full-size touch targets. */
export function SickBayCard({
  item,
  withdrawalDaysLeft,
  onManageCase,
  onApplyProtocol,
  onDelete,
}: {
  item: HealthCaseListItem;
  withdrawalDaysLeft: number | undefined;
  onManageCase: (caseId: string) => void;
  onApplyProtocol: (item: HealthCaseListItem) => void;
  onDelete: (item: HealthCaseListItem) => void;
}) {
  const t = useTranslations("health.sickBay");
  const showWithdrawal = withdrawalDaysLeft != null || item.isSafetyWithholdingActive;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <AnimalLink id={item.cattle.id} animalName={item.cattle.name} tagNumber={item.cattle.tagNumber} className="flex min-w-0 items-center gap-2 text-left font-normal">
          <Avatar className="size-9">
            {item.cattle.image ? <AvatarImage src={item.cattle.image} alt="" /> : null}
            <AvatarFallback>{(item.cattle.name ?? item.cattle.tagNumber).slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{item.cattle.name ?? item.cattle.tagNumber}</span>
            <span className="truncate text-xs text-muted-foreground">{[item.cattle.tagNumber, item.shedName].filter(Boolean).join(" · ")}</span>
          </span>
        </AnimalLink>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <PriorityChip priority={item.priority} />
          <DayCell startDate={item.startDate} />
        </div>
      </div>

      <ConditionCell item={item} />

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("columns.protocol")}>
          <ProtocolCell item={item} onApply={onApplyProtocol} />
        </Field>
        <Field label={t("columns.nextStep")}>
          <NextStepCell item={item} />
        </Field>
        {showWithdrawal ? (
          <Field label={t("columns.withdrawal")}>
            <WithdrawalCell item={item} daysLeft={withdrawalDaysLeft} />
          </Field>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onManageCase(item.id)}>
          {t("manageCase")}
        </Button>
        <Can I="healthcare.delete">
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 text-destructive" aria-label={t("deleteCase")} onClick={() => onDelete(item)}>
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </Can>
      </div>
    </div>
  );
}

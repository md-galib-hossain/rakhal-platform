"use client"; // row actions open the Case Management sheet, an Apply Protocol sheet + a delete confirm dialog

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { useCan } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/errors";
import { Avatar, AvatarFallback, AvatarImage } from "@rakhal/ui/ui/avatar";
import { Button } from "@rakhal/ui/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { AnimalLink } from "@/components/shared/animal-link";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@rakhal/ui/ui/sheet";
import { useDeleteHealthCase, useSafetyWithdrawals } from "../hooks/use-health";
import { withdrawalDaysByCase } from "../sick-bay-model";
import { ProtocolPicker } from "./protocol-picker";
import { SickBayCard } from "./sick-bay-card";
import { ConditionCell, DayCell, NextStepCell, PriorityChip, ProtocolCell, WithdrawalCell } from "./sick-bay-cells";
import type { HealthCaseListItem, HealthPriority } from "../types";

const COLUMNS = [
  { key: "animal", wide: false },
  { key: "condition", wide: false },
  { key: "protocol", wide: true },
  { key: "nextStep", wide: false },
  { key: "withdrawal", wide: true },
  { key: "priority", wide: false },
  { key: "day", wide: true },
  { key: "action", wide: false },
] as const;
/** Shown only when the table's own container is >= 56rem wide. */
const WIDE = "hidden @4xl:table-cell";
/** A coloured left edge on the first cell: the urgent cases are findable at a glance, not by reading chips. */
const PRIORITY_EDGE: Record<HealthPriority, string> = {
  CRITICAL: "border-l-destructive",
  HIGH: "border-l-warning",
  MEDIUM: "border-l-transparent",
  LOW: "border-l-transparent",
};

/** RFE-106 — "Apply Protocol" row action: attaches a plan to a case that already exists (no UI
 * path did this before; the only Apply flow always created a brand-new duplicate case). Same
 * `POST /health/cases/:id/apply-plan` `edit-applied-plan-dialog.tsx` uses for its reschedule flow. **RFE-136**: the plan
 * list is the shared `ProtocolPicker`, so protocols tagged with the case's condition come first and the selected
 * one previews its real dates, withdrawal and reminders. */
function ApplyProtocolDialog({
  item,
  onOpenChange,
}: {
  item: HealthCaseListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("health.sickBay.applyProtocolDialog");

  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      {item ? (
        <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("title", { name: item.cattle.name ?? item.cattle.tagNumber })}</SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            <ProtocolPicker caseId={item.id} condition={item.condition} onApplied={() => onOpenChange(false)} />
          </div>

          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
          </SheetFooter>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

/** Sick Bay (Figma "Health Management Center" table, node 734:35802, reshaped by RFE-134 / EPIC_HEALTH_CENTER D11):
 * Animal (name / tag / shed) · Condition · Protocol (chip + progress, or an "Apply protocol" button) · Next step ·
 * Withdrawal (days left) · Priority · Day N · actions. Below `md` each case is a card instead (`SickBayCard`) — the
 * table needs ~860px and a shed is usually visited on a phone. Backed by the real `GET /health/sick-bay`; the
 * withdrawal days come from the active `GET /health/safety-withdrawals`, matched by case. */
export function SickBayTable({
  items,
  isLoading,
  isError,
  onRetry,
  onManageCase,
}: {
  items: HealthCaseListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onManageCase: (caseId: string) => void;
}) {
  const t = useTranslations("health.sickBay");
  const [deleteTarget, setDeleteTarget] = useState<HealthCaseListItem | null>(null);
  const [applyTarget, setApplyTarget] = useState<HealthCaseListItem | null>(null);
  const deleteCase = useDeleteHealthCase();
  const can = useCan();
  const canDelete = can("healthcare.delete");
  const canUpdate = can("healthcare.update");
  const withdrawals = useSafetyWithdrawals({ activeOnly: true, limit: 100 });
  const daysByCase = useMemo(() => withdrawalDaysByCase(withdrawals.data?.items ?? []), [withdrawals.data]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCase.mutateAsync(deleteTarget.id);
      toast.success(t("deletedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState description={t("error")} onRetry={onRetry} />;
  if (items.length === 0) return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;

  return (
    <>
      {/* A container query, not a viewport one: with the sidebar open the card is ~650px wide at a 1024px window. Below
          56rem the lesser columns (Protocol, Withdrawal, Day) fold away - the withdrawal chip moves under Priority - so
          Animal, Condition, Next step, Priority and the action are all visible without scrolling. */}
      <div className="@container hidden overflow-x-auto rounded-2xl border border-border md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted">
            <tr>
              {COLUMNS.map(({ key, wide }) => (
                <th key={key} className={cn("h-12 px-2 text-left text-sm font-medium text-muted-foreground first:pl-3", wide && WIDE)}>
                  {key === "action" ? <span className="sr-only">{t(`columns.${key}`)}</span> : t(`columns.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const withdrawalDays = daysByCase.get(item.id);
              const hasWithdrawal = withdrawalDays != null || item.isSafetyWithholdingActive;
              const canApply = canUpdate && !item.healthPlan;
              return (
                <tr key={item.id} className="border-t border-border align-middle">
                  <td className={cn("border-l-4 py-2 pl-2 pr-2", PRIORITY_EDGE[item.priority])}>
                    <AnimalLink
                      id={item.cattle.id}
                      animalName={item.cattle.name}
                      tagNumber={item.cattle.tagNumber}
                      className="group flex min-w-0 items-center gap-2 text-left font-normal"
                    >
                      <Avatar className="size-8 shrink-0">
                        {item.cattle.image ? <AvatarImage src={item.cattle.image} alt="" /> : null}
                        <AvatarFallback>{(item.cattle.name ?? item.cattle.tagNumber).slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 max-w-[6.5rem] flex-col @4xl:max-w-[11rem]">
                        <p className="truncate text-sm font-medium text-foreground group-hover:underline">{item.cattle.name ?? item.cattle.tagNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">{[item.cattle.tagNumber, item.shedName].filter(Boolean).join(" · ")}</p>
                      </div>
                    </AnimalLink>
                  </td>
                  <td className="max-w-[7rem] px-2 py-2 @4xl:max-w-[12rem]">
                    <ConditionCell item={item} />
                  </td>
                  <td className={cn("max-w-[240px] px-2 py-2", WIDE)}>
                    <ProtocolCell item={item} onApply={setApplyTarget} />
                  </td>
                  <td className="max-w-[150px] px-2 py-2 @4xl:max-w-[170px]">
                    <NextStepCell item={item} />
                  </td>
                  <td className={cn("px-2 py-2", WIDE)}>
                    <WithdrawalCell item={item} daysLeft={withdrawalDays} />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col items-start gap-1">
                      <PriorityChip priority={item.priority} />
                      {hasWithdrawal ? (
                        <div className="@4xl:hidden">
                          <WithdrawalCell item={item} daysLeft={withdrawalDays} />
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className={cn("px-2 py-2", WIDE)}>
                    <DayCell startDate={item.startDate} />
                  </td>
                  <td className="py-2 pl-2 pr-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => onManageCase(item.id)}>
                        {t("manageCase")}
                      </Button>
                      <RowActionsMenu
                        menuLabel={t("moreActions")}
                        actions={[
                          ...(canApply ? [{ key: "apply", label: t("applyProtocol"), onSelect: () => setApplyTarget(item) }] : []),
                          ...(canDelete ? [{ key: "delete", label: t("deleteCase"), destructive: true, onSelect: () => setDeleteTarget(item) }] : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <SickBayCard
            key={item.id}
            item={item}
            withdrawalDaysLeft={daysByCase.get(item.id)}
            onManageCase={onManageCase}
            onApplyProtocol={setApplyTarget}
            onDelete={setDeleteTarget}
          />
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteDialog.title")}
        description={t("deleteDialog.description", { name: deleteTarget?.cattle?.name ?? deleteTarget?.cattle?.tagNumber ?? "" })}
        confirmLabel={t("deleteDialog.confirm")}
        cancelLabel={t("deleteDialog.cancel")}
        onConfirm={confirmDelete}
      />
      <ApplyProtocolDialog item={applyTarget} onOpenChange={(open) => !open && setApplyTarget(null)} />
    </>
  );
}

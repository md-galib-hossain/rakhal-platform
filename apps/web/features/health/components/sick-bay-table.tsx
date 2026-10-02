"use client"; // row actions open the Case Management sheet, an Apply Protocol sheet + a delete confirm dialog

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Can } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/errors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AnimalLink } from "@/components/shared/animal-link";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDeleteHealthCase, useSafetyWithdrawals } from "../hooks/use-health";
import { withdrawalDaysByCase } from "../sick-bay-model";
import { ProtocolPicker } from "./protocol-picker";
import { SickBayCard } from "./sick-bay-card";
import { ConditionCell, DayCell, NextStepCell, PriorityChip, ProtocolCell, WithdrawalCell } from "./sick-bay-cells";
import type { HealthCaseListItem } from "../types";

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
      <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-muted">
            <tr>
              {["animal", "condition", "protocol", "nextStep", "withdrawal", "priority", "day", "action"].map((col) => (
                <th key={col} className="h-[54px] px-2 text-left text-sm font-medium text-muted-foreground">
                  {t(`columns.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border align-middle">
                <td className="px-2 py-2">
                  <AnimalLink
                    id={item.cattle.id}
                    animalName={item.cattle.name}
                    tagNumber={item.cattle.tagNumber}
                    className="group flex items-center gap-2 text-left font-normal"
                  >
                    <Avatar className="size-8">
                      {item.cattle.image ? <AvatarImage src={item.cattle.image} alt="" /> : null}
                      <AvatarFallback>{(item.cattle.name ?? item.cattle.tagNumber).slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-foreground group-hover:underline">{item.cattle.name ?? item.cattle.tagNumber}</p>
                      <p className="text-xs text-muted-foreground">{[item.cattle.tagNumber, item.shedName].filter(Boolean).join(" · ")}</p>
                    </div>
                  </AnimalLink>
                </td>
                <td className="px-2 py-2">
                  <ConditionCell item={item} />
                </td>
                <td className="max-w-[240px] px-2 py-2">
                  <ProtocolCell item={item} onApply={setApplyTarget} />
                </td>
                <td className="max-w-[170px] px-2 py-2">
                  <NextStepCell item={item} />
                </td>
                <td className="px-2 py-2">
                  <WithdrawalCell item={item} daysLeft={daysByCase.get(item.id)} />
                </td>
                <td className="px-2 py-2">
                  <PriorityChip priority={item.priority} />
                </td>
                <td className="px-2 py-2">
                  <DayCell startDate={item.startDate} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => onManageCase(item.id)}>
                      {t("manageCase")}
                    </Button>
                    <Can I="healthcare.delete">
                      <Button variant="ghost" size="icon" aria-label={t("deleteCase")} onClick={() => setDeleteTarget(item)}>
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
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
        description={t("deleteDialog.description")}
        confirmLabel={t("deleteDialog.confirm")}
        cancelLabel={t("deleteDialog.cancel")}
        onConfirm={confirmDelete}
      />
      <ApplyProtocolDialog item={applyTarget} onOpenChange={(open) => !open && setApplyTarget(null)} />
    </>
  );
}

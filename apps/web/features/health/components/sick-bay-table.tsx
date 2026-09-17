"use client"; // row actions open the Case Management sheet, an Apply Protocol sheet + a delete confirm dialog

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ShieldPlus, Trash2 } from "lucide-react";
import type { Locale } from "@/lib/constants/i18n";
import { Can } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/errors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AnimalLink } from "@/components/shared/animal-link";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { diagnosisChipVariant, formatDoseWhen } from "../format";
import { useApplyPlanToCase, useDeleteHealthCase, useHealthPlans } from "../hooks/use-health";
import { ProgressRing } from "./progress-ring";
import type { HealthCaseListItem } from "../types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** RFE-106 — "Apply Protocol" row action: attaches a plan to a case that already exists (no UI
 * path did this before; the only Apply flow always created a brand-new duplicate case). Same
 * `POST /health/cases/:id/apply-plan` `edit-applied-plan-dialog.tsx` uses for its reschedule flow. */
function ApplyProtocolDialog({
  item,
  onOpenChange,
}: {
  item: HealthCaseListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("health.sickBay.applyProtocolDialog");
  const [healthPlanId, setHealthPlanId] = useState<string | undefined>(undefined);
  const [startDate, setStartDate] = useState(todayIso);
  const [pending, setPending] = useState(false);
  const plansQuery = useHealthPlans();
  const applyPlan = useApplyPlanToCase();

  function handleOpenChange(next: boolean) {
    if (next) {
      setHealthPlanId(undefined);
      setStartDate(todayIso());
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!item || !healthPlanId) return;
    setPending(true);
    try {
      await applyPlan.mutateAsync({ caseId: item.id, dto: { healthPlanId, startDate } });
      toast.success(t("appliedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={item !== null} onOpenChange={handleOpenChange}>
      {item ? (
        <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("title", { name: item.cattle.name ?? item.cattle.tagNumber })}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-3 py-3">
            <Select value={healthPlanId} onValueChange={setHealthPlanId}>
              <LabeledSelectTrigger label={t("selectPlan")} placeholder={t("selectPlanPlaceholder")} />
              <SelectContent>
                {(plansQuery.data?.items ?? []).map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePicker label={t("startDate")} value={startDate} onChange={setStartDate} disabled={pending} />
          </div>

          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={pending || !healthPlanId}>
              {pending ? "…" : t("confirm")}
            </Button>
          </SheetFooter>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

/** Figma "Health Management Center" table — Sick Bay tab (node 734:35802): Name (avatar+tag) / Shed
 * / Diagnosis (chip) / Treatment / Progress (X/total ring) / Next Dose / Action. Backed by the real
 * `GET /health/sick-bay` (`health.service.ts#getSickBay`) — `Treatment` has no dedicated backend
 * field, so it's derived from the linked `healthPlan.name` + step count (falls back to "—" when no
 * plan is applied yet, same as the Figma mock's own "-" rows for unplanned cases). */
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
  const locale = useLocale() as Locale;
  const [deleteTarget, setDeleteTarget] = useState<HealthCaseListItem | null>(null);
  const [applyTarget, setApplyTarget] = useState<HealthCaseListItem | null>(null);
  const deleteCase = useDeleteHealthCase();

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
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead className="bg-muted">
          <tr>
            {["name", "shed", "diagnosis", "treatment", "progress", "nextDose", "action"].map((col) => (
              <th key={col} className="h-[54px] px-2 text-left text-sm font-medium text-muted-foreground">
                {t(`columns.${col}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const nextTask = item.tasks[0];
            const dose = nextTask ? formatDoseWhen(nextTask.dueDateTime, locale, t("today"), t("tomorrow")) : null;
            const treatment = item.healthPlan
              ? `${item.healthPlan.name}${item.totalSteps ? `, ${item.totalSteps}` : ""}`
              : "—";
            return (
              <tr key={item.id} className="border-t border-border">
                <td className="px-2 py-2">
                  <AnimalLink
                    id={item.cattle.id}
                    animalName={item.cattle.name}
                    tagNumber={item.cattle.tagNumber}
                    className="flex items-center gap-2 text-left group font-normal"
                  >
                    <Avatar className="size-8">
                      {item.cattle.image ? <AvatarImage src={item.cattle.image} alt="" /> : null}
                      <AvatarFallback>{(item.cattle.name ?? item.cattle.tagNumber).slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-foreground group-hover:underline">{item.cattle.name ?? item.cattle.tagNumber}</p>
                      <p className="text-xs text-muted-foreground">{item.cattle.tagNumber}</p>
                    </div>
                  </AnimalLink>
                </td>
                <td className="px-2 py-2 text-sm text-foreground">{item.shedName ?? "—"}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip variant={diagnosisChipVariant(item.diagnosis)}>{item.diagnosis ?? "—"}</Chip>
                    {item.condition ? <Chip variant="muted">{t(`conditionValue.${item.condition}`)}</Chip> : null}
                  </div>
                </td>
                <td className="max-w-[180px] truncate px-2 py-2 text-sm text-foreground">{treatment}</td>
                <td className="px-2 py-2">
                  {item.totalSteps > 0 ? (
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-foreground">
                        {item.currentStep}
                        <span className="text-muted-foreground">/{item.totalSteps}</span>
                      </p>
                      <ProgressRing value={item.progressPercentage} />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {dose ? (
                    <div className="flex flex-col">
                      <p className="text-sm text-foreground">{dose.day}</p>
                      <p className="text-xs text-muted-foreground">{dose.time}</p>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => onManageCase(item.id)}>
                      {t("manageCase")}
                    </Button>
                    <Can I="healthcare.update">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("applyProtocol")}
                        title={t("applyProtocol")}
                        onClick={() => setApplyTarget(item)}
                      >
                        <ShieldPlus className="size-4 text-foreground" aria-hidden />
                      </Button>
                    </Can>
                    <Can I="healthcare.delete">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("deleteCase")}
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    </Can>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
    </div>
  );
}

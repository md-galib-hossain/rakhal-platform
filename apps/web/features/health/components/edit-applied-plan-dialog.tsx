"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnimalLink } from "@/components/shared/animal-link";
import { useApplyPlanToCase, useCreateHealthCase, useDeleteHealthCase } from "../hooks/use-health";
import type { AppliedPlanListItem } from "../types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Map plan category → diagnosisType (mirrors apply-health-plan-dialog.tsx). */
const CATEGORY_TO_DIAGNOSIS_TYPE: Record<
  AppliedPlanListItem["healthPlan"]["category"],
  AppliedPlanListItem["diagnosisType"]
> = {
  TREATMENT: "DISEASE",
  PREVENTION: "PREVENTIVE",
  BREEDING: "BREEDING_RELATED",
  VACCINATION: "VACCINATION",
  DEWORMING: "DEWORMING",
  ROUTINE: "ROUTINE_CHECKUP",
};

/**
 * "Edit Applied Plan" dialog — lets the user pick a new start date for an applied plan instance.
 * Strategy: delete the existing HealthCase (soft-delete, cancels pending tasks), create a fresh
 * one for the same cow, then apply the same health plan with the new start date. This is the
 * simplest and most correct approach; completed treatment logs on the old case are preserved
 * (they are on the old `healthCaseId`).
 */
export function EditAppliedPlanDialog({
  item,
  open,
  onOpenChange,
}: {
  item: AppliedPlanListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("health.healthPlan.activePlans.editDialog");
  const [startDate, setStartDate] = useState(todayIso);
  const [pending, setPending] = useState(false);

  const deleteCase = useDeleteHealthCase();
  const createCase = useCreateHealthCase();
  const applyPlan = useApplyPlanToCase();

  // Reset date each time the dialog opens for a new item
  function handleOpenChange(next: boolean) {
    if (next) setStartDate(todayIso());
    onOpenChange(next);
  }

  async function handleSave() {
    if (!item) return;
    setPending(true);
    try {
      // 1. Cancel the current applied plan case (soft-delete → all pending tasks become inactive)
      await deleteCase.mutateAsync(item.id);

      // 2. Create a fresh HealthCase for the same cow with the same diagnosis type
      const diagnosisType = CATEGORY_TO_DIAGNOSIS_TYPE[item.healthPlan.category];
      const newCase = await createCase.mutateAsync({
        cattleId: item.cattle.id,
        diagnosis: item.healthPlan.name,
        diagnosisType,
        priority: "LOW",
        startDate,
      });

      // 3. Apply the same plan to the new case with the chosen start date
      await applyPlan.mutateAsync({
        caseId: newCase.id,
        dto: { healthPlanId: item.healthPlan.id, startDate },
      });

      toast.success(t("savedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    } finally {
      setPending(false);
    }
  }

  if (!item) return null;

  const cattleName = item.cattle.name ?? item.cattle.tagNumber;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        {/* Animal + plan context row */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <Avatar className="size-9 shrink-0">
            {item.cattle.image && <AvatarImage src={item.cattle.image} alt={cattleName} />}
            <AvatarFallback className="text-xs font-semibold">
              {(item.cattle.name ?? item.cattle.tagNumber).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <AnimalLink id={item.cattle.id} animalName={item.cattle.name} tagNumber={item.cattle.tagNumber} className="min-w-0 flex-1 font-normal group">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium group-hover:underline">{cattleName}</p>
              <p className="truncate text-xs text-muted-foreground">#{item.cattle.tagNumber}</p>
            </div>
          </AnimalLink>
          <span className="shrink-0 text-sm font-medium text-foreground">{item.healthPlan.name}</span>
        </div>

        {/* New start date picker */}
        <div className="mt-2">
          <DatePicker
            label={t("newStartDate")}
            value={startDate}
            onChange={setStartDate}
            disabled={pending}
          />
        </div>

        {/* Warning note */}
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-xs leading-relaxed">{t("rescheduleNote")}</p>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={pending || !startDate}>
            {pending ? "…" : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

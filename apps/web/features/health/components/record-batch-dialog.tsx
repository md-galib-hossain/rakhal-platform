"use client"; // selection state + mutations

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, ArrowRightToLine, Ban, Check, Package, Search } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { useCompleteTask, useLogTreatment } from "../hooks/use-health";
import { groupIncompleteTasks, taskCategoryChip, type ScheduledTaskGroup } from "../task-grouping";
import { SkipTaskDialog } from "./skip-task-dialog";
import { AnimalLink } from "@/components/shared/animal-link";
import type { HealthTask } from "../types";

/** AQR bump per completed dose — `AqrService`'s real `treatment_completed` rule
 * (`health.service.ts#logTreatment`), mirrored here only to preview the real total, not invented. */
const AQR_PER_TREATMENT = 3;

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg border border-border p-2">
      <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
        <Package className="size-3.5" aria-hidden />
        {label}
      </span>
      <p className="truncate text-sm text-foreground">{value}</p>
    </div>
  );
}

/**
 * "Record Vaccination" / batch treatment-recording drawer — Figma 734:43007 (`get_design_context`):
 * read-only Due/Medicine/Dose/Route/Action tiles, a searchable "Selected Animals" list (checkbox per
 * pending animal, defaults to all selected), a footer summary (selected count / total dosage / AQR
 * impact), Cancel + Confirm. On confirm, loops the real `POST /health/cases/:id/log-treatment` (one
 * call per selected animal's case, `healthTaskId` set) — the same endpoint the Case Management
 * sheet's "Log Treatment" tab already uses, which marks that task `COMPLETED` and applies the real
 * `+3` AQR event server-side. There is no bulk/batch treatment endpoint, so this is N real calls, not
 * a fabricated batch action.
 */
export function RecordBatchDialog({ group, onOpenChange }: { group: ScheduledTaskGroup | undefined; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={Boolean(group)} onOpenChange={onOpenChange}>
      {group ? <RecordBatchDialogBody key={group.key} group={group} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function RecordBatchDialogBody({ group, onOpenChange }: { group: ScheduledTaskGroup; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("health.taskHub.recordBatch");
  const logTreatment = useLogTreatment();
  const completeTask = useCompleteTask();
  const category = taskCategoryChip(group.taskType);
  const allPending = groupIncompleteTasks(group);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allPending.map((task) => task.id)));
  const [submitting, setSubmitting] = useState(false);
  // Rows the user explicitly Skipped or quick-Completed this session — hidden immediately rather
  // than waiting for the group prop (a snapshot from when the sheet opened) to catch up.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [skippingTask, setSkippingTask] = useState<HealthTask | null>(null);

  const pending = useMemo(() => allPending.filter((task) => !dismissed.has(task.id)), [allPending, dismissed]);

  const filtered = pending.filter((task) => {
    const name = task.cattle?.name ?? task.cattle?.tagNumber ?? "";
    const tag = task.cattle?.tagNumber ?? "";
    const q = search.trim().toLowerCase();
    return !q || name.toLowerCase().includes(q) || tag.toLowerCase().includes(q);
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  /** No medicine on this whole group (e.g. a CHECKUP/OBSERVATION task) — a per-row quick Complete
   * skips the log-treatment call entirely rather than creating a meaningless medicine-less
   * treatment log row. A medicine-bearing group keeps its animals routed through Confirm→log-treatment
   * (real stock decrement + AQR), unaffected by this. */
  const canQuickComplete = !group.medicineName;

  async function handleQuickComplete(task: HealthTask) {
    try {
      await completeTask.mutateAsync(task.id);
      toast.success(t("completedToast"));
      dismiss(task.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const selectedCount = selected.size;
  const totalDosage = group.doseAmount != null ? Math.round(group.doseAmount * selectedCount * 100) / 100 : null;
  const aqrImpact = selectedCount * AQR_PER_TREATMENT;

  async function handleConfirm() {
    const tasks = pending.filter((task) => selected.has(task.id));
    if (tasks.length === 0) {
      toast.error(t("noneSelectedError"));
      return;
    }
    setSubmitting(true);
    try {
      for (const task of tasks) {
        await logTreatment.mutateAsync({
          id: task.healthCaseId,
          dto: {
            healthTaskId: task.id,
            medicineName: group.medicineName ?? undefined,
            doseAmount: group.doseAmount ?? undefined,
            doseUnit: group.doseUnit ?? undefined,
            route: group.route ?? undefined,
            administeredAt: new Date().toISOString(),
          },
        });
      }
      toast.success(t("recordedToast", { count: tasks.length }));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[600px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[600px]"
    >
      <div className="flex items-start justify-between pb-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-xl font-bold text-foreground">{t("title", { name: group.title })}</SheetTitle>
            <Chip variant={category.variant}>{t(`category.${category.labelKey}`)}</Chip>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-4">
        <div className="flex items-center gap-3">
          <InfoTile label={t("due")} value={new Date(group.dueDateTime).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} />
          <InfoTile label={t("medicine")} value={group.medicineName ?? "—"} />
        </div>
        <div className="flex items-center gap-3">
          <InfoTile label={t("dose")} value={group.doseAmount != null ? `${group.doseAmount} ${group.doseUnit ?? ""}`.trim() : "—"} />
          <InfoTile label={t("route")} value={group.route ?? "—"} />
        </div>
        <div className="rounded-lg border border-border p-2">
          <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <Package className="size-3.5" aria-hidden />
            {t("action")}
          </span>
          <p className="mt-2 text-sm text-foreground">{group.instruction ?? "—"}</p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{t("selectedAnimals")}</p>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((t2) => t2.id)))}
            >
              {selected.size === pending.length ? t("deselectAll") : t("selectAll")}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" />
          </div>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">{t("noAnimals")}</p>
            ) : (
              filtered.map((task) => {
                const cattleId = task.cattleId ?? (task.cattle as { id?: string })?.id;
                return (
                  <div key={task.id} className="flex items-center gap-3 p-3">
                    <label className="flex flex-1 cursor-pointer items-center gap-3">
                      <Checkbox checked={selected.has(task.id)} onCheckedChange={() => toggle(task.id)} />
                      <Avatar className="size-8">
                        <AvatarFallback>{(task.cattle?.name ?? task.cattle?.tagNumber ?? "?").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        {cattleId ? (
                          <AnimalLink
                            id={cattleId}
                            animalName={task.cattle?.name}
                            tagNumber={task.cattle?.tagNumber}
                            className="text-sm font-medium text-foreground hover:text-primary"
                          >
                            {task.cattle?.name ?? task.cattle?.tagNumber ?? "—"}
                          </AnimalLink>
                        ) : (
                          <span className="text-sm font-medium text-foreground">{task.cattle?.name ?? task.cattle?.tagNumber ?? "—"}</span>
                        )}
                        {task.cattle?.name ? <span className="text-xs text-muted-foreground">{task.cattle.tagNumber}</span> : null}
                      </div>
                    </label>
                  <div className="flex shrink-0 items-center gap-1">
                    {canQuickComplete ? (
                      <Can I="healthcare.log-treatment">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-success hover:bg-success-tint"
                          title={t("quickComplete")}
                          onClick={() => void handleQuickComplete(task)}
                          disabled={completeTask.isPending}
                        >
                          <Check className="size-4" aria-hidden />
                        </Button>
                      </Can>
                    ) : null}
                    <Can I="healthcare.update">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:bg-destructive-tint"
                        title={t("skip")}
                        onClick={() => setSkippingTask(task)}
                      >
                        <Ban className="size-4" aria-hidden />
                      </Button>
                    </Can>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-border" />
      <div className="flex flex-col gap-3 pt-5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{t("selectedCount", { count: selectedCount })}</span>
          {totalDosage != null ? (
            <>
              <span className="text-border">|</span>
              <span>{t("totalDosage", { value: `${totalDosage} ${group.doseUnit ?? ""}`.trim() })}</span>
            </>
          ) : null}
          <span className="text-border">|</span>
          <span className="flex items-center gap-1">
            {t("aqrImpact")}
            <Chip variant="primary">+{aqrImpact}</Chip>
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="button" className="h-[52px] flex-1 gap-2 rounded-xl" onClick={handleConfirm} disabled={submitting || selectedCount === 0}>
            {submitting ? "…" : t("confirm")}
            {!submitting ? <ArrowRight className="size-[18px]" aria-hidden /> : null}
          </Button>
        </div>
      </div>

      <SkipTaskDialog
        task={skippingTask}
        onOpenChange={(open) => !open && setSkippingTask(null)}
        onSkipped={dismiss}
      />
    </SheetContent>
  );
}

"use client"; // live query + confirm state

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, SkipForward, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import { Card } from "@rakhal/ui/ui/card";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateText } from "@/components/shared/date-text";
import { ErrorState } from "@/components/shared/error-state";
import { useCancelAnimalProtocol, useCattleProtocols, useSkipTask, useStopCattleProtocol } from "../hooks/use-health";
import { ProtocolRemoveDialog, type RemoveMode } from "./protocol-remove-dialog";
import type { CattleProtocolRun } from "../types";
import { AppliedProtocolChip } from "./applied-protocol-chip";

type Pending = { kind: "skip" | "remove"; run: CattleProtocolRun } | null;

const kindOf = (run: CattleProtocolRun): "TREATMENT" | "PREVENTION" | "BREEDING" =>
  run.healthPlan.category === "TREATMENT" ? "TREATMENT" : run.healthPlan.category === "BREEDING" ? "BREEDING" : "PREVENTION";

/**
 * Every protocol one animal is on, in one place (the cow profile's Health tab). The Protocols tab shows
 * protocol → animals; this is the other direction, animal → protocols, covering both treatment protocols running on a
 * sickness case and preventive / breeding rounds. Each row: protocol + step progress, the next step with its date
 * (overdue is flagged), and — with `healthcare.update` — skip the next step, or take the animal off the protocol
 * (its remaining steps are skipped and kept in history; a sickness case stays open for manual care).
 * Rescheduling and recording a step stay in the protocol sheet ("Open protocols").
 */
export function CattleProtocolsSection({ cattleId }: { cattleId: string }) {
  const t = useTranslations("health.cattleProtocols");
  const tKind = useTranslations("health.healthPlan.filters.kind");
  const queryClient = useQueryClient();
  const query = useCattleProtocols(cattleId);
  const skipTask = useSkipTask();
  const stopProtocol = useStopCattleProtocol(cattleId);
  const cancelProtocol = useCancelAnimalProtocol();
  const tUndo = useTranslations("health.protocolUndo");
  const [pending, setPending] = useState<Pending>(null);

  if (query.isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (query.isError) return <ErrorState description={t("error")} onRetry={() => void query.refetch()} />;
  const runs = query.data?.items ?? [];

  async function confirm() {
    if (!pending) return;
    const { kind, run } = pending;
    try {
      if (kind === "skip" && run.nextStep) {
        await skipTask.mutateAsync({ id: run.nextStep.id, dto: {} });
        void queryClient.invalidateQueries({ queryKey: ["health", "cattle-protocols"] });
        void queryClient.invalidateQueries({ queryKey: ["health", "plans"] });
        toast.success(t("skippedToast"));
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  /** Stop keeps what happened; Cancel (applied by mistake) reverses every recorded dose and deletes the steps, in one call. */
  async function confirmRemove(mode: RemoveMode, reason: string | undefined) {
    if (pending?.kind !== "remove") return;
    const { run } = pending;
    const target = run.healthCaseId ? { healthCaseId: run.healthCaseId } : { planEnrollmentId: run.planEnrollmentId ?? undefined };
    try {
      if (mode === "cancel") {
        const result = await cancelProtocol.mutateAsync({ cattleId, dto: { ...target, reason } });
        toast.success(tUndo("cancelledToast", { doses: result.dosesReversed }));
      } else {
        await stopProtocol.mutateAsync({ ...target, reason });
        toast.success(t("removedToast"));
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
      throw err;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/healthcare?healthTab=protocols">
            <ExternalLink className="size-3.5" aria-hidden />
            {t("openProtocols")}
          </Link>
        </Button>
      </div>

      {runs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        runs.map((run) => {
          const overdue = run.nextStep?.status === "OVERDUE";
          return (
            <Card key={`${run.runType}-${run.id}`} className="flex flex-col gap-3 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <AppliedProtocolChip name={run.healthPlan.name} current={run.currentStep} total={run.totalSteps} />
                  <Chip variant="muted">{tKind(kindOf(run))}</Chip>
                  {run.caseCode ? <span className="text-xs text-muted-foreground">{run.caseCode}</span> : null}
                </div>
                {run.totalSteps > 0 ? (
                  <span className="text-xs text-muted-foreground">{t("stepOf", { current: run.currentStep, total: run.totalSteps })}</span>
                ) : null}
              </div>

              {run.nextStep ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t("next")}</span>
                  <span className="font-medium text-foreground">{run.nextStep.title}</span>
                  <span className="text-muted-foreground">
                    · <DateText date={run.nextStep.dueDateTime} />
                  </span>
                  {overdue ? <Chip variant="destructive">{t("overdue")}</Chip> : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noNextStep")}</p>
              )}

              <Can I="healthcare.update">
                <div className="flex flex-wrap gap-2">
                  {run.nextStep ? (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setPending({ kind: "skip", run })}>
                      <SkipForward className="size-3.5" aria-hidden />
                      {t("skipNext")}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setPending({ kind: "remove", run })}>
                    <UserMinus className="size-3.5" aria-hidden />
                    {t("remove")}
                  </Button>
                </div>
              </Can>
            </Card>
          );
        })
      )}

      <ConfirmDialog
        open={pending?.kind === "skip"}
        onOpenChange={(open) => !open && setPending(null)}
        title={t("skipConfirmTitle")}
        description={pending?.kind === "skip" ? t("skipConfirmBody", { step: pending.run.nextStep?.title ?? "", protocol: pending.run.healthPlan.name }) : undefined}
        confirmLabel={t("skipNext")}
        cancelLabel={t("cancel")}
        onConfirm={confirm}
      />
      <ProtocolRemoveDialog
        open={pending?.kind === "remove"}
        onOpenChange={(open) => !open && setPending(null)}
        protocolName={pending?.run.healthPlan.name ?? ""}
        hasCase={Boolean(pending?.run.healthCaseId)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

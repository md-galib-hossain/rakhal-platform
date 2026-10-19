"use client"; // remove-assignment mutation + per-row program lookup

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, RotateCcw, X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Can } from "@/lib/auth/permissions";
import { useCattleProgram, useRemoveFeedAssignment } from "../../feed/hooks/use-feed-plans";
import type { ApplyTarget } from "../../feed/components/plans/apply-plan-dialog";
import type { FeedGridSection } from "../../feed/plans-types";
import { ProgramPicker } from "./program-picker";
import { TruncatedText } from "@/components/shared/truncated-text";

/**
 * A cow's program, right under her name: the plan she is on (click to change it to another plan / TMR / concentrate),
 * "reset" to put the plan's lines back after editing today's kg, and "remove" for a program applied to her alone.
 * A group or whole-herd program can't be removed for one cow — changing her program gives her her own instead, which
 * takes over from the group's. Without `feed.update` the chip is read-only.
 */
export function ProgramCell({
  cattleId,
  cowName,
  section,
  edited,
  onPick,
  onReset,
  onReload,
}: {
  cattleId: string;
  cowName: string;
  section: FeedGridSection | undefined;
  /** Her lines differ from the plan (a kg changed, a line removed or added). */
  edited: boolean;
  onPick: (target: ApplyTarget) => void;
  onReset: () => void;
  onReload: () => void;
}) {
  const t = useTranslations("feeding.grid.unified.program");
  const tKind = useTranslations("feed.plans.kind");
  const tp = useTranslations("feeding.programs");
  const remove = useRemoveFeedAssignment();
  // Only an individual program can be removed for her alone; look up its assignment id just for those rows.
  const individual = section?.via === "INDIVIDUAL";
  const program = useCattleProgram(individual ? cattleId : undefined);
  const assignmentId = program.data?.program?.assignment_id;

  async function handleRemove() {
    if (!assignmentId) return;
    try {
      await remove.mutateAsync(assignmentId);
      toast.success(t("removedToast", { animal: cowName }));
      onReload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const chipBody = section ? (
    <>
      <TruncatedText>{section.plan_name}</TruncatedText>
      <span className="shrink-0 opacity-70">· {tKind(section.kind)}</span>
    </>
  ) : (
    <>
      <Plus className="size-3" aria-hidden />
      {t("addProgram")}
    </>
  );
  const chipClass = cn(
    "flex max-w-[190px] items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
    section ? "border-primary/30 bg-primary/10 text-primary" : "border-dashed border-input text-muted-foreground",
  );

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <Can I="feed.update" fallback={section ? <span className={chipClass}>{chipBody}</span> : null}>
        <ProgramPicker onPick={onPick}>
          <button
            type="button"
            aria-label={section ? t("change", { plan: section.plan_name }) : t("apply", { animal: cowName })}
            className={cn(chipClass, "transition-colors", section ? "hover:bg-primary/15" : "hover:border-primary/50 hover:text-foreground")}
          >
            {chipBody}
          </button>
        </ProgramPicker>

        {section && edited ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t("reset")}
                onClick={onReset}
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="size-3" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("reset")}</TooltipContent>
          </Tooltip>
        ) : null}

        {section && individual ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t("remove")}
                disabled={!assignmentId || remove.isPending}
                onClick={() => void handleRemove()}
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                <X className="size-3" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("remove")}</TooltipContent>
          </Tooltip>
        ) : null}
      </Can>
      {section && !individual ? <span className="text-xs text-muted-foreground">{tp(`via.${section.via}`)}</span> : null}
    </div>
  );
}

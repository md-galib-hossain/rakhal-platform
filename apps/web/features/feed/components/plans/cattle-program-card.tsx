"use client"; // program query + Remove confirm state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { Card } from "@rakhal/ui/ui/card";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { Can } from "@/lib/auth/permissions";
import { useCattleProgram, useRemoveFeedAssignment } from "../../hooks/use-feed-plans";

/**
 * "Feeding program" on the cattle-detail Feeding tab (MILESTONE 27, RFE-126): which feed plan this animal is
 * on today, how it reaches her (her own program, her group's, or the herd default) and its lines. **Remove**
 * ends her *own* program only — a program that reaches her through a group or the herd belongs to that
 * group/herd, so it is changed from the Feed Plans tab instead (removing it here would silently change
 * every other animal on it).
 */
export function CattleProgramCard({ cattleId }: { cattleId: string }) {
  const t = useTranslations("feed.plans.cattleProgram");
  const program = useCattleProgram(cattleId);
  const remove = useRemoveFeedAssignment();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (program.isLoading) return <CardSkeleton lines={3} />;
  if (program.isError) return <ErrorState onRetry={() => program.refetch()} />;

  const p = program.data?.program;

  async function confirmRemove() {
    if (!p) return;
    try {
      await remove.mutateAsync(p.assignment_id);
      toast.success(t("removedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm font-semibold text-foreground">{t("title")}</p>
      {!p ? (
        <EmptyState icon={ClipboardList} title={t("none")} description={t("noneDescription")} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{p.plan_name}</span>
            <Badge variant={p.via === "INDIVIDUAL" ? "success" : "secondary"}>{t(`via.${p.via}`)}</Badge>
          </div>
          {p.conflict ? <p className="text-xs text-warning">{t("conflict")}</p> : null}
          <ul className="flex flex-col gap-1 text-sm">
            {p.lines.map((l) => (
              <li key={l.line_id} className="flex justify-between gap-2">
                <span className="truncate text-foreground">
                  {l.name}
                  {l.stock_ok ? "" : ` · ${t("noStock")}`}
                </span>
                <span className="shrink-0 text-muted-foreground">{t("kgLine", { kg: l.kg_per_day })}</span>
              </li>
            ))}
          </ul>
          {p.via === "INDIVIDUAL" ? (
            <Can I="feed.update">
              <div>
                <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
                  {t("remove")}
                </Button>
              </div>
            </Can>
          ) : (
            <p className="text-xs text-muted-foreground">{t("changeElsewhere")}</p>
          )}
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={t("removeConfirmTitle")}
            description={t("removeConfirmDescription", { name: p.plan_name })}
            confirmLabel={t("remove")}
            onConfirm={confirmRemove}
          />
        </>
      )}
    </Card>
  );
}

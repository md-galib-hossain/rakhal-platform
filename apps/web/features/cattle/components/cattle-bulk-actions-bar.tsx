"use client"; // selection-driven dialogs + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBulkCattle, useFeedGroups, useSheds } from "../hooks/use-cattle";
import type { CattleListItem } from "../types";

/** Bulk change-shed / change-feed-group / mark-sold / export — one aggregate `{updated,failed}`
 * result per action (no per-row detail, `bulk-cattle.dto.ts`), surfaced as a toast. Gated behind
 * `cattle.bulk` (a single permission covers all 4 actions on the backend). */
export function CattleBulkActionsBar({
  selectedIds,
  selectedItems,
  onDone,
}: {
  selectedIds: string[];
  selectedItems: CattleListItem[];
  onDone: () => void;
}) {
  const t = useTranslations("cattle.bulk");
  const bulk = useBulkCattle();
  const sheds = useSheds();
  const feedGroups = useFeedGroups();
  const [shedDialogOpen, setShedDialogOpen] = useState(false);
  const [feedGroupDialogOpen, setFeedGroupDialogOpen] = useState(false);
  const [markSoldOpen, setMarkSoldOpen] = useState(false);
  const [shedId, setShedId] = useState<string | undefined>(undefined);
  const [feedGroupId, setFeedGroupId] = useState<string | undefined>(undefined);

  if (selectedIds.length === 0) return null;

  async function run(action: "change_shed" | "change_feed_group" | "mark_sold", payload?: { shedId?: string; feedGroupId?: string }) {
    try {
      const result = await bulk.mutateAsync({ cattleIds: selectedIds, action, payload });
      toast.success(t("resultToast", { updated: result.updated, failed: result.failed }));
      onDone();
    } catch {
      toast.error(t("failedToast"));
    }
  }

  function exportCsv() {
    const header = ["name", "tagNumber", "breed", "shed", "productionStatus", "healthStatus", "aqrScore"];
    const rows = selectedItems.map((c) => [
      c.name ?? "",
      c.tagNumber,
      c.breed?.name ?? "",
      c.shed?.name ?? "",
      c.productionStatus,
      c.healthStatus,
      c.aqrScore ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cattle-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Can I="cattle.bulk">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
        <p className="text-sm font-medium text-foreground">{t("selectedCount", { count: selectedIds.length })}</p>
        <Button variant="outline" size="sm" onClick={() => setShedDialogOpen(true)}>
          {t("changeShed")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setFeedGroupDialogOpen(true)}>
          {t("changeFeedGroup")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMarkSoldOpen(true)}>
          {t("markSold")}
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          {t("export")}
        </Button>
      </div>

      <Dialog open={shedDialogOpen} onOpenChange={setShedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("changeShed")}</DialogTitle>
            <DialogDescription>{t("changeShedDescription", { count: selectedIds.length })}</DialogDescription>
          </DialogHeader>
          <Select value={shedId} onValueChange={setShedId}>
            <SelectTrigger aria-label={t("shedLabel")}>
              <SelectValue placeholder={t("shedLabel")} />
            </SelectTrigger>
            <SelectContent>
              {(sheds.data?.items ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShedDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={!shedId || bulk.isPending}
              onClick={async () => {
                await run("change_shed", { shedId });
                setShedDialogOpen(false);
                setShedId(undefined);
              }}
            >
              {t("apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feedGroupDialogOpen} onOpenChange={setFeedGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("changeFeedGroup")}</DialogTitle>
            <DialogDescription>{t("changeFeedGroupDescription", { count: selectedIds.length })}</DialogDescription>
          </DialogHeader>
          <Select value={feedGroupId} onValueChange={setFeedGroupId}>
            <SelectTrigger aria-label={t("feedGroupLabel")}>
              <SelectValue placeholder={t("feedGroupLabel")} />
            </SelectTrigger>
            <SelectContent>
              {(feedGroups.data ?? []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedGroupDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={bulk.isPending}
              onClick={async () => {
                await run("change_feed_group", { feedGroupId });
                setFeedGroupDialogOpen(false);
                setFeedGroupId(undefined);
              }}
            >
              {t("apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={markSoldOpen}
        onOpenChange={setMarkSoldOpen}
        title={t("markSold")}
        description={t("markSoldDescription", { count: selectedIds.length })}
        confirmLabel={t("markSold")}
        variant="destructive"
        onConfirm={() => run("mark_sold")}
      />
    </Can>
  );
}

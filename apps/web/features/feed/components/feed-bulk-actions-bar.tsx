"use client"; // selection count + delete-confirm dialog

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useBulkDeleteConcentrations } from "../hooks/use-feed";

/** Multi-select delete bar (user request 2026-07-18, reworked 2026-07-18 follow-up) — renders only
 * once at least one card in this section is checked (no separate "select mode" toggle anywhere), one
 * instance per `ConcentrationSection` so Concentrate Mixer and Total Mixed Ration (TMR) each get their own
 * independent selection/Select-All/delete, never a shared cross-section selection. Same "N selected" +
 * action + Cancel shape as `features/cattle/components/cattle-bulk-actions-bar.tsx`, scaled down to
 * Feed's one bulk action plus Select All. */
export function FeedBulkActionsBar({
  selectedIds,
  allSelected,
  onSelectAll,
  onCancel,
  onDone,
}: {
  selectedIds: string[];
  allSelected: boolean;
  onSelectAll: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("feed.bulk");
  const bulkDelete = useBulkDeleteConcentrations();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (selectedIds.length === 0) return null;

  async function handleConfirm() {
    try {
      const result = await bulkDelete.mutateAsync(selectedIds);
      toast.success(t("deletedToast", { count: result.deleted }));
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-sm font-medium text-foreground">{t("selectedCount", { count: selectedIds.length })}</p>
      {!allSelected ? (
        <Button variant="outline" size="sm" onClick={onSelectAll}>
          {t("selectAll")}
        </Button>
      ) : null}
      <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
        {t("deleteSelected")}
      </Button>
      <Button variant="outline" size="sm" onClick={onCancel}>
        {t("cancel")}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { count: selectedIds.length })}
        confirmLabel={t("deleteSelected")}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

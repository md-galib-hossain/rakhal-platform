"use client"; // selection count + delete-confirm dialog

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useBulkDeleteConcentrations } from "../hooks/use-feed";

/** Multi-select delete bar (user request 2026-07-18) — same "N selected" + action + Cancel shape as
 * `features/cattle/components/cattle-bulk-actions-bar.tsx`, scaled down to Feed's one bulk action. */
export function FeedBulkActionsBar({
  selectedIds,
  onCancel,
  onDone,
}: {
  selectedIds: string[];
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

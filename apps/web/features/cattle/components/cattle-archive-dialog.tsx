"use client"; // reason select + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useArchiveCattle } from "../hooks/use-cattle";
import type { CattleArchiveInput } from "../schemas";
import type { CattleListItem } from "../types";

const REASONS: CattleArchiveInput["reason"][] = ["sold", "deceased", "culled", "archived"];

/** RAKHAL-290/297-F: `sold`/`deceased`/`culled` are real lifecycle exits that auto-close any
 * ACTIVE `Lactation` server-side (`archiveWithReason`). `archived` alone never touches it. */
const REASONS_CLOSING_LACTATION: ReadonlySet<CattleArchiveInput["reason"]> = new Set([
  "sold",
  "deceased",
  "culled",
]);

/**
 * `DELETE /cattle/:id` with an `ArchiveCattleDto` reason (CAT-08/09/10) — sold/deceased keep
 * production status distinct from a plain archive. Small custom Dialog rather than the generic
 * `ConfirmDialog` since this one needs an extra reason field (same pattern as the bulk
 * mark-shed/feed-group dialogs in `cattle-bulk-actions-bar.tsx`).
 */
export function CattleArchiveDialog({
  open,
  onOpenChange,
  cattle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattle: CattleListItem | null;
}) {
  const t = useTranslations("cattle.archiveDialog");
  const archive = useArchiveCattle();
  const [reason, setReason] = useState<CattleArchiveInput["reason"]>("sold");
  const [notes, setNotes] = useState("");

  if (!cattle) return null;

  async function handleConfirm() {
    if (!cattle) return;
    try {
      await archive.mutateAsync({ id: cattle.id, dto: { reason, notes: notes.trim() || undefined } });
      toast.success(t("archivedToast"));
      onOpenChange(false);
      setNotes("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { name: cattle.name ?? cattle.tagNumber })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label>{t("reason")}</Label>
          <Select value={reason} onValueChange={(v) => setReason(v as CattleArchiveInput["reason"])}>
            <SelectTrigger aria-label={t("reason")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`reasonOptions.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="archive-notes">{t("notes")}</Label>
          <Textarea
            id="archive-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={3}
          />
        </div>
        {cattle.productionStatus === "MILKING" && REASONS_CLOSING_LACTATION.has(reason) ? (
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-tint px-3 py-2 text-sm text-warning">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <p>{t("closesLactationWarning")}</p>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={archive.isPending}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={archive.isPending}>
            {archive.isPending ? "…" : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

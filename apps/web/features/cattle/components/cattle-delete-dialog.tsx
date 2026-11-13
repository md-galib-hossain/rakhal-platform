"use client"; // notes field + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@rakhal/ui/ui/label";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { useDeleteCattle } from "../hooks/use-cattle";
import type { CattleListItem } from "../types";

/**
 * `DELETE /cattle/:id` (RAKHAL-400/402) — a real soft-delete, for duplicate/mistake records only.
 * Split out of the old combined `CattleArchiveDialog`: an animal that actually left the herd
 * (sold/culled/deceased) is a disposition (`CattleDisposeDialog`), not a delete. The backend
 * refuses (409) when the animal has any real history (milk logs/health cases/breeding events) —
 * that message is surfaced here as-is rather than a generic error, since it tells the farmer
 * exactly what to do instead (dispose it).
 */
export function CattleDeleteDialog({
  open,
  onOpenChange,
  cattle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattle: CattleListItem | null;
}) {
  const t = useTranslations("cattle.deleteDialog");
  const deleteCattle = useDeleteCattle();
  const [notes, setNotes] = useState("");

  if (!cattle) return null;

  async function handleConfirm() {
    if (!cattle) return;
    try {
      await deleteCattle.mutateAsync({ id: cattle.id, dto: { notes: notes.trim() || undefined } });
      toast.success(t("deletedToast"));
      onOpenChange(false);
      setNotes("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title", { name: cattle.name ?? cattle.tagNumber })}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-notes">{t("notes")}</Label>
          <Textarea
            id="delete-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={3}
          />
        </div>
        <SheetFooter className="border-t border-dashed border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleteCattle.isPending}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleteCattle.isPending}>
            {deleteCattle.isPending ? "…" : t("confirm")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

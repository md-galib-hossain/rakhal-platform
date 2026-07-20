"use client"; // small quick-update form + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUpdateFeedItem } from "../hooks/use-inventory";
import type { FeedItem } from "../types";

/**
 * Figma's "Item Details - Forage" drawer (732:13304) has a dedicated "Stock Update" CTA next to
 * "Edit Item". Unlike Medicine (`AdjustMedicineStockPayload`, a separate audited
 * `POST /inventory/medicines/:id/adjust-stock` endpoint with a signed delta + reason), a feed item
 * has no such route — `currentStock` is just a normal field on `PATCH /inventory/feed-items/:id`
 * (`UpdateFeedItemDto`, see `types.ts#FeedItem` doc comment). This is a small dedicated dialog for
 * that one field rather than reusing the full `FeedItemFormDialog`, matching the Figma CTA's scope
 * without inventing a backend capability that isn't there.
 */
export function FeedItemStockUpdateDialog({
  feedItem,
  open,
  onOpenChange,
}: {
  feedItem: FeedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("inventory.feed.stockUpdate");
  const updateFeedItem = useUpdateFeedItem();
  const [value, setValue] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedItem) return;
    const currentStock = Number(value);
    if (!Number.isFinite(currentStock) || currentStock < 0) return;
    try {
      await updateFeedItem.mutateAsync({ id: feedItem.id, dto: { currentStock } });
      toast.success(t("updatedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && feedItem) setValue(String(feedItem.currentStock));
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { name: feedItem?.name ?? "", unit: feedItem?.unit ?? "" })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Label htmlFor="stock-update-value">{t("label", { unit: feedItem?.unit ?? "" })}</Label>
          <Input
            id="stock-update-value"
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateFeedItem.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={updateFeedItem.isPending}>
              {updateFeedItem.isPending ? "…" : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

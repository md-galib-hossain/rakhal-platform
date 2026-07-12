"use client"; // small quick-update form + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUpdateForage } from "../hooks/use-inventory";
import type { Forage } from "../types";

/**
 * Figma's "Item Details - Forage" drawer (732:13304) has a dedicated "Stock Update" CTA next to
 * "Edit Item". Unlike Medicine (`AdjustMedicineStockPayload`, a separate audited
 * `POST /inventory/medicines/:id/adjust-stock` endpoint with a signed delta + reason), Forage has
 * no such route — `currentStock` is just a normal field on `PATCH /inventory/forages/:id`
 * (`UpdateForageDto`, see `types.ts#Forage` doc comment). This is a small dedicated dialog for that
 * one field rather than reusing the full `ForageFormDialog`, matching the Figma CTA's scope without
 * inventing a backend capability that isn't there.
 */
export function ForageStockUpdateDialog({
  forage,
  open,
  onOpenChange,
}: {
  forage: Forage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("inventory.forage.stockUpdate");
  const updateForage = useUpdateForage();
  const [value, setValue] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!forage) return;
    const currentStock = Number(value);
    if (!Number.isFinite(currentStock) || currentStock < 0) return;
    try {
      await updateForage.mutateAsync({ id: forage.id, dto: { currentStock } });
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
        if (next && forage) setValue(String(forage.currentStock));
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { name: forage?.name ?? "", unit: forage?.unit ?? "" })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Label htmlFor="stock-update-value">{t("label", { unit: forage?.unit ?? "" })}</Label>
          <Input
            id="stock-update-value"
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateForage.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={updateForage.isPending}>
              {updateForage.isPending ? "…" : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client"; // mutation state

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeleteSupplier } from "@/features/settings/hooks/use-workspace-mutations";
import { useInvalidateSuppliersV2 } from "../hooks";
import type { SupplierRow } from "../types";

/** RAKHAL-390 — deactivate (soft-delete via the existing `DELETE /settings/suppliers/:id`, which
 * sets `deleted_at`, never a hard delete). Same reuse-not-fork reasoning as `SupplierFormDialog`. */
export function SupplierDeleteDialog({
  supplier,
  open,
  onOpenChange,
}: {
  supplier: SupplierRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("suppliers.deleteDialog");
  const deleteSupplier = useDeleteSupplier();
  const invalidateSuppliersV2 = useInvalidateSuppliersV2();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { name: supplier?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={deleteSupplier.isPending}
            onClick={() => {
              if (!supplier) return;
              deleteSupplier.mutate(supplier.id, {
                onSuccess: () => {
                  invalidateSuppliersV2();
                  toast.success(t("successToast"));
                  onOpenChange(false);
                },
                onError: (err) => {
                  toast.error(err instanceof ApiError ? err.message : t("genericError"));
                },
              });
            }}
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

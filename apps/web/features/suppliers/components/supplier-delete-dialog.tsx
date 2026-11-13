"use client"; // mutation state

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@rakhal/ui/ui/sheet";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title", { name: supplier?.name ?? "" })}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="border-t border-dashed border-border pt-4">
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

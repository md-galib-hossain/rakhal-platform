"use client"; // dropdown menu + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { RecordSaleDialog } from "@/features/sales/components/record-sale-wizard";
import { useRestoreMedicine } from "../hooks/use-inventory";
import type { Medicine } from "../types";

/** Per-row menu (edit / archive / restore) — same anatomy as `CattleRowActions`. `triggerClassName`
 * lets the grid card give the trigger a translucent circular backdrop so it stays legible over a
 * photo/color-block image — the table cell usage leaves it unset (plain ghost icon button). */
export function MedicineRowActions({
  medicine,
  onEdit,
  onArchive,
  triggerClassName,
}: {
  medicine: Medicine;
  onEdit: (medicine: Medicine) => void;
  onArchive: (medicine: Medicine) => void;
  triggerClassName?: string;
}) {
  const t = useTranslations("inventory.actions");
  const can = useCan();
  const restore = useRestoreMedicine();
  const canUpdate = can("inventory.update");
  const canSell = can("finance.create");
  const [sellOpen, setSellOpen] = useState(false);

  async function handleRestore() {
    try {
      await restore.mutateAsync(medicine.id);
      toast.success(t("restoredToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("menu")} className={cn(triggerClassName)}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canUpdate ? <DropdownMenuItem onSelect={() => onEdit(medicine)}>{t("edit")}</DropdownMenuItem> : null}
          {/* RAKHAL-361 — "Sell" domain entry point, `SellInventoryUseCase` has no HTTP route yet
              (see `features/sales/types.ts`'s top doc comment) so the wizard is reachable and
              pre-filled but honestly blocks the final submit, same as every other consumer of this
              wizard's "not available yet" state. Only offered on an active (non-archived) item. */}
          {canSell && medicine.isActive ? (
            <DropdownMenuItem onSelect={() => setSellOpen(true)}>{t("sell")}</DropdownMenuItem>
          ) : null}
          {medicine.isActive
            ? canUpdate && (
                <DropdownMenuItem onSelect={() => onArchive(medicine)} className="text-destructive">
                  {t("archive")}
                </DropdownMenuItem>
              )
            : canUpdate && <DropdownMenuItem onSelect={handleRestore}>{t("restore")}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <RecordSaleDialog
        open={sellOpen}
        onOpenChange={setSellOpen}
        initial={{ type: "PRODUCT", productSubtype: "INVENTORY", description: medicine.name }}
      />
    </>
  );
}

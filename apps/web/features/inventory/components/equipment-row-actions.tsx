"use client"; // dropdown menu + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { RecordSaleDialog } from "@/features/sales/components/record-sale-wizard";
import { useRestoreEquipment } from "../hooks/use-inventory";
import type { Equipment } from "../types";

/** Per-row menu (edit / archive / restore) — same anatomy as `MedicineRowActions`. */
export function EquipmentRowActions({
  equipment,
  onEdit,
  onArchive,
  triggerClassName,
}: {
  equipment: Equipment;
  onEdit: (equipment: Equipment) => void;
  onArchive: (equipment: Equipment) => void;
  triggerClassName?: string;
}) {
  const t = useTranslations("inventory.actions");
  const can = useCan();
  const restore = useRestoreEquipment();
  const canUpdate = can("inventory.update");
  const canSell = can("finance.create");
  const [sellOpen, setSellOpen] = useState(false);

  async function handleRestore() {
    try {
      await restore.mutateAsync(equipment.id);
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
          {canUpdate ? <DropdownMenuItem onSelect={() => onEdit(equipment)}>{t("edit")}</DropdownMenuItem> : null}
          {/* RAKHAL-361 — same "Sell" entry point as Medicine's row actions; see that file's doc
              comment for why this is honestly reachable-but-blocked. */}
          {canSell && equipment.isActive ? (
            <DropdownMenuItem onSelect={() => setSellOpen(true)}>{t("sell")}</DropdownMenuItem>
          ) : null}
          {equipment.isActive
            ? canUpdate && (
                <DropdownMenuItem onSelect={() => onArchive(equipment)} className="text-destructive">
                  {t("archive")}
                </DropdownMenuItem>
              )
            : canUpdate && <DropdownMenuItem onSelect={handleRestore}>{t("restore")}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <RecordSaleDialog
        open={sellOpen}
        onOpenChange={setSellOpen}
        initial={{ type: "PRODUCT", productSubtype: "INVENTORY", description: equipment.name }}
      />
    </>
  );
}

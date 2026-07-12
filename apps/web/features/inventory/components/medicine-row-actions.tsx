"use client"; // dropdown menu + mutation

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

  async function handleRestore() {
    try {
      await restore.mutateAsync(medicine.id);
      toast.success(t("restoredToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("menu")} className={cn(triggerClassName)}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canUpdate ? <DropdownMenuItem onSelect={() => onEdit(medicine)}>{t("edit")}</DropdownMenuItem> : null}
        {medicine.isActive
          ? canUpdate && (
              <DropdownMenuItem onSelect={() => onArchive(medicine)} className="text-destructive">
                {t("archive")}
              </DropdownMenuItem>
            )
          : canUpdate && <DropdownMenuItem onSelect={handleRestore}>{t("restore")}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

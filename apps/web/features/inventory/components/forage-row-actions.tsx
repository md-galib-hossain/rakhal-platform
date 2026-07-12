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
import { useRestoreForage } from "../hooks/use-inventory";
import type { Forage } from "../types";

/** Per-row menu (view / edit / archive / restore) — same anatomy as `MedicineRowActions`, plus a
 * "View Details" entry (Figma's "Item Details - Forage" side modal, which Medicine doesn't have
 * yet) as the first item, mirroring `CattleRowActions`' ordering. */
export function ForageRowActions({
  forage,
  onView,
  onEdit,
  onArchive,
  triggerClassName,
}: {
  forage: Forage;
  onView: (forage: Forage) => void;
  onEdit: (forage: Forage) => void;
  onArchive: (forage: Forage) => void;
  triggerClassName?: string;
}) {
  const t = useTranslations("inventory.actions");
  // `restoredToast`/`genericError` under the shared `inventory.actions` scope are hardcoded to
  // "Medicine …" text (pre-existing, not this ticket's to rename) — Forage uses its own namespace
  // for those two strings instead of reusing the wrong wording.
  const tForage = useTranslations("inventory.forage");
  const can = useCan();
  const restore = useRestoreForage();
  const canUpdate = can("inventory.update");

  async function handleRestore() {
    try {
      await restore.mutateAsync(forage.id);
      toast.success(tForage("restoredToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tForage("genericError"));
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
        <DropdownMenuItem onSelect={() => onView(forage)}>{t("viewDetails")}</DropdownMenuItem>
        {canUpdate ? <DropdownMenuItem onSelect={() => onEdit(forage)}>{t("edit")}</DropdownMenuItem> : null}
        {forage.isActive
          ? canUpdate && (
              <DropdownMenuItem onSelect={() => onArchive(forage)} className="text-destructive">
                {t("archive")}
              </DropdownMenuItem>
            )
          : canUpdate && <DropdownMenuItem onSelect={handleRestore}>{t("restore")}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

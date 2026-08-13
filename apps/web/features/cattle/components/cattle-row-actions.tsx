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
import { useRestoreCattle } from "../hooks/use-cattle";
import type { CattleListItem } from "../types";

/** Per-row menu (edit / archive / restore) — RFE-022's entry points into the add/edit form and
 * archive dialog owned by the parent `CattleTable`. Status change (production/reproductive) is
 * folded into the Edit Animal modal itself (`CattleFormDialog`'s Status section) rather than a
 * separate menu item/dialog. */
export function CattleRowActions({
  cattle,
  onView,
  onEdit,
  onArchive,
}: {
  cattle: CattleListItem;
  onView: (cattle: CattleListItem) => void;
  onEdit: (cattle: CattleListItem) => void;
  onArchive: (cattle: CattleListItem) => void;
}) {
  const t = useTranslations("cattle.actions");
  const can = useCan();
  const restore = useRestoreCattle();
  const isArchived = cattle.status === "SOLD" || cattle.status === "DEAD" || cattle.status === "ARCHIVED";
  const canUpdate = can("cattle.update");
  const canArchive = can("cattle.archive");

  async function handleRestore() {
    try {
      await restore.mutateAsync(cattle.id);
      toast.success(t("restoredToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("menu")}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onView(cattle)}>{t("viewDetails")}</DropdownMenuItem>
        {canUpdate ? <DropdownMenuItem onSelect={() => onEdit(cattle)}>{t("edit")}</DropdownMenuItem> : null}
        {isArchived
          ? canUpdate && <DropdownMenuItem onSelect={handleRestore}>{t("restore")}</DropdownMenuItem>
          : canArchive && (
              <DropdownMenuItem onSelect={() => onArchive(cattle)} className="text-destructive">
                {t("archive")}
              </DropdownMenuItem>
            )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

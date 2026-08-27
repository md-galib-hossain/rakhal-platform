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

/** Per-row menu (edit / dispose / delete / restore) — RFE-022's entry points into the add/edit
 * form and the dispose/delete dialogs owned by the parent `CattleTable`. Status change
 * (production/reproductive) is folded into the Edit Animal modal itself (`CattleFormDialog`'s
 * Status section) rather than a separate menu item/dialog.
 *
 * RAKHAL-402: `restore` is gated on `deletedAt`, not `status` — `deletedAt` and `status`/
 * `HerdStatus` are independent dimensions (RAKHAL-400). `restore()` server-side only ever clears
 * `deletedAt`; it never resets `status` back to ACTIVE (fixed as a RAKHAL-397 side effect, since
 * that used to let a restore silently resurrect a DECEASED animal onto the active herd). The old
 * `isArchived` check kept "Restore" gated on `status` instead — a soft-deleted-but-still-ACTIVE row
 * had no restore entry point at all, and a disposed-but-not-deleted row showed a "Restore" that
 * would call an endpoint that does nothing for it. */
export function CattleRowActions({
  cattle,
  onView,
  onEdit,
  onDispose,
  onDelete,
}: {
  cattle: CattleListItem;
  onView: (cattle: CattleListItem) => void;
  onEdit: (cattle: CattleListItem) => void;
  onDispose: (cattle: CattleListItem) => void;
  onDelete: (cattle: CattleListItem) => void;
}) {
  const t = useTranslations("cattle.actions");
  const can = useCan();
  const restore = useRestoreCattle();
  const isDeleted = cattle.deletedAt !== null;
  const isDisposed = cattle.status !== "ACTIVE";
  const canUpdate = can("cattle.update");
  const canDispose = can("cattle.dispose");
  const canDelete = can("cattle.delete");

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
        {isDeleted ? (
          canUpdate && <DropdownMenuItem onSelect={handleRestore}>{t("restore")}</DropdownMenuItem>
        ) : isDisposed ? null : (
          <>
            {canDispose && (
              <DropdownMenuItem onSelect={() => onDispose(cattle)} className="text-destructive">
                {t("dispose")}
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem onSelect={() => onDelete(cattle)} className="text-destructive">
                {t("delete")}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

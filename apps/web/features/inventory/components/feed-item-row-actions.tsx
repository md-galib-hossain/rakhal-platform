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
import { useRestoreFeedItem } from "../hooks/use-inventory";
import type { FeedItem } from "../types";

/** Per-row menu (view / edit / archive / restore) — same anatomy as `MedicineRowActions`, plus a
 * "View Details" entry (Figma's "Item Details - Forage" side modal, which Medicine doesn't have
 * yet) as the first item, mirroring `CattleRowActions`' ordering. */
export function FeedItemRowActions({
  feedItem,
  onView,
  onEdit,
  onArchive,
  triggerClassName,
}: {
  feedItem: FeedItem;
  onView: (feedItem: FeedItem) => void;
  onEdit: (feedItem: FeedItem) => void;
  onArchive: (feedItem: FeedItem) => void;
  triggerClassName?: string;
}) {
  const t = useTranslations("inventory.actions");
  // `restoredToast`/`genericError` under the shared `inventory.actions` scope are hardcoded to
  // "Medicine …" text (pre-existing, not this ticket's to rename) — Feed uses its own namespace
  // for those two strings instead of reusing the wrong wording.
  const tFeed = useTranslations("inventory.feed");
  const can = useCan();
  const restore = useRestoreFeedItem();
  const canUpdate = can("inventory.update");
  const canSell = can("finance.create");
  const [sellOpen, setSellOpen] = useState(false);

  async function handleRestore() {
    try {
      await restore.mutateAsync(feedItem.id);
      toast.success(tFeed("restoredToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tFeed("genericError"));
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
          <DropdownMenuItem onSelect={() => onView(feedItem)}>{t("viewDetails")}</DropdownMenuItem>
          {canUpdate ? <DropdownMenuItem onSelect={() => onEdit(feedItem)}>{t("edit")}</DropdownMenuItem> : null}
          {/* RAKHAL-361 — same "Sell" entry point as Medicine's row actions; see that file's doc
              comment for why this is honestly reachable-but-blocked (`SellInventoryUseCase` has no
              HTTP route yet). */}
          {canSell && feedItem.isActive ? (
            <DropdownMenuItem onSelect={() => setSellOpen(true)}>{t("sell")}</DropdownMenuItem>
          ) : null}
          {feedItem.isActive
            ? canUpdate && (
                <DropdownMenuItem onSelect={() => onArchive(feedItem)} className="text-destructive">
                  {t("archive")}
                </DropdownMenuItem>
              )
            : canUpdate && <DropdownMenuItem onSelect={handleRestore}>{t("restore")}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <RecordSaleDialog
        open={sellOpen}
        onOpenChange={setSellOpen}
        initial={{ type: "PRODUCT", productSubtype: "INVENTORY", description: feedItem.name }}
      />
    </>
  );
}

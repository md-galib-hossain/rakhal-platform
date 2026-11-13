"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";

/** Page-header "Add Item" trigger — parent (`EquipmentView`) owns the shared create/edit
 * `EquipmentFormDialog` instance, this is just the gated button that opens it in create mode. */
export function EquipmentAddButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("inventory.equipment.form");
  return (
    <Can I="inventory.create">
      <Button onClick={onClick}>
        <Plus className="size-4" aria-hidden />
        {t("add")}
      </Button>
    </Can>
  );
}

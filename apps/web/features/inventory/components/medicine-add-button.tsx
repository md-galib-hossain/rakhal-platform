"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

/** Page-header "Add Medicine" trigger — parent (`MedicineView`) owns the shared create/edit
 * `MedicineFormDialog` instance, this is just the gated button that opens it in create mode. */
export function MedicineAddButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("inventory.medicine.form");
  return (
    <Can I="inventory.create">
      <Button size="sm" onClick={onClick}>
        <Plus className="size-4" aria-hidden />
        {t("add")}
      </Button>
    </Can>
  );
}

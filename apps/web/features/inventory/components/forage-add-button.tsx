"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

/** Page-header "Add Forage" trigger — parent (`ForageView`) owns the shared create/edit
 * `ForageFormSheet` instance, this is just the gated button that opens it in create mode. */
export function ForageAddButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("inventory.forage.form");
  return (
    <Can I="inventory.create">
      <Button onClick={onClick}>
        <Plus className="size-4" aria-hidden />
        {t("add")}
      </Button>
    </Can>
  );
}

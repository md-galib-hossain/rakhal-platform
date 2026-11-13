"use client"; // owns its own create-dialog open state

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import { CattleFormDialog } from "./cattle-form-dialog";

/** Page-header "Add cattle" trigger — a standalone `CattleFormDialog` instance in create mode
 * (no `cattle` prop), separate from `CattleTable`'s edit/status/archive dialogs. */
export function CattleAddButton() {
  const t = useTranslations("cattle.form");
  const [open, setOpen] = useState(false);

  return (
    <Can I="cattle.create">
      {/* Default (md/h-11) size — matches the search input's height in the same toolbar row. */}
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {t("addCattle")}
      </Button>
      <CattleFormDialog open={open} onOpenChange={setOpen} />
    </Can>
  );
}

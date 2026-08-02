"use client"; // owns its own import-dialog open state

import { useState } from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { MilkImportDialog } from "./milk-import-dialog";

/** Milk Log header "Import Excel" trigger — mirrors `CattleImportButton`, gated on `milk.log`
 * (import is bulk save, same permission as a manual entry). */
export function MilkImportButton() {
  const t = useTranslations("milk.import");
  const [open, setOpen] = useState(false);

  return (
    <Can I="milk.log">
      <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setOpen(true)}>
        <Upload className="size-3.5" aria-hidden />
        {t("trigger")}
      </Button>
      <MilkImportDialog open={open} onOpenChange={setOpen} />
    </Can>
  );
}

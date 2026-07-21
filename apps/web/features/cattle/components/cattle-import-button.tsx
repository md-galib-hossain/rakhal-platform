"use client"; // owns its own import-dialog open state

import { useState } from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { CattleImportDialog } from "./cattle-import-dialog";

/** Page-header "Import CSV" trigger (RFE-024) — same permission as create (`cattle.create`), since
 * import is bulk create. Sibling to `CattleAddButton` in the list toolbar. */
export function CattleImportButton() {
  const t = useTranslations("cattle.import");
  const [open, setOpen] = useState(false);

  return (
    <Can I="cattle.create">
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" aria-hidden />
        {t("trigger")}
      </Button>
      <CattleImportDialog open={open} onOpenChange={setOpen} />
    </Can>
  );
}

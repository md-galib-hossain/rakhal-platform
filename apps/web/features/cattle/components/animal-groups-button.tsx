"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import { AnimalGroupsDialog } from "./animal-groups-dialog";

/** Page-header "Animal Groups" trigger — opens the Animal Groups & Members management sheet. */
export function AnimalGroupsButton() {
  const t = useTranslations("cattle.groups");
  const [open, setOpen] = useState(false);

  return (
    <Can I="cattle.read">
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Layers className="size-4" aria-hidden />
        {t("button")}
      </Button>
      <AnimalGroupsDialog open={open} onOpenChange={setOpen} />
    </Can>
  );
}

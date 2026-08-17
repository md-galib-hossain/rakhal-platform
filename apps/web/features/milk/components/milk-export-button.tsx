"use client"; // owns its own export-dialog open state

import { useState } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import type { MilkLogRow } from "../types";
import { MilkExportDialog } from "./milk-export-dialog";

/** Milk Log header "Export" trigger — opens a modal to pick all/specific cows + a date range,
 * then downloads a real `.xlsx` (`POST /milk/export`). `cattleOptions` comes from whatever day is
 * currently loaded (cow list doesn't change per-day), just for the "select cows" picker. */
export function MilkExportButton({ cattleOptions }: { cattleOptions: MilkLogRow[] }) {
  const t = useTranslations("milk.export");
  const [open, setOpen] = useState(false);

  return (
    <Can I="milk.read">
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="size-4" aria-hidden />
        {t("trigger")}
      </Button>
      <MilkExportDialog open={open} onOpenChange={setOpen} cattleOptions={cattleOptions} />
    </Can>
  );
}

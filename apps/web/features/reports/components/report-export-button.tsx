"use client"; // dialog-open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { useHasFeature } from "@/features/subscription/hooks/use-subscription-gates";
import { GenerateReportDialog, type GenerateReportDialogDef } from "./report-catalogue";

/**
 * Page-level "Export" trigger for the async Reports engine (`POST /reports/generate` → poll →
 * download, RD-013a) — a thin wrapper around the existing `GenerateReportDialog` so Cattle/Milk/
 * Finance/Healthcare/Dashboard can each drop in one button targeting their own fixed `reportId`
 * (see `../report-defs.ts`) instead of routing through the generic `/reports` catalogue page.
 * Gated the same way the Reports page itself is: `reports.create` RBAC permission (hides for a
 * worker) + the `reports.generate` Pro subscription feature (hides if the farm isn't on that plan
 * — no separate "locked" state here, since this button is a convenience shortcut, not the feature's
 * primary entry point; a farm without the feature can still reach `/reports` to see the upsell).
 */
export function ReportExportButton({
  report,
  size = "sm",
  variant = "outline",
}: {
  report: GenerateReportDialogDef;
  size?: "sm" | "md";
  variant?: "outline" | "secondary";
}) {
  const t = useTranslations("reports");
  const hasFeature = useHasFeature();
  const [open, setOpen] = useState(false);

  if (!hasFeature("reports.generate")) return null;

  return (
    <Can I="reports.create">
      <Button variant={variant} size={size} className="gap-2" onClick={() => setOpen(true)}>
        <Download className="size-3.5" aria-hidden />
        {t("export")}
      </Button>
      {open ? <GenerateReportDialog report={report} open onOpenChange={setOpen} /> : null}
    </Can>
  );
}

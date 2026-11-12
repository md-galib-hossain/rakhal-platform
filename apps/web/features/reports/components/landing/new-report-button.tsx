"use client"; // permission + plan gating (client session caches)

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useReportsAccessState } from "./use-reports-access-state";

/**
 * Primary header action. Needs `reports.create` (otherwise not shown: the user could never use it). When the plan lacks
 * `reports.generate` the button stays visible but inactive (`aria-disabled`, still focusable) with the reason in a tooltip
 * and in the page notice, never silently hidden.
 */
export function NewReportButton() {
  const tl = useTranslations("reportsLanding");
  const access = useReportsAccessState();

  if (!access.ready || !access.canRead || !access.canCreate) return null;

  if (access.planBlocked) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              aria-disabled
              aria-describedby="reports-plan-notice"
              className="cursor-not-allowed opacity-50 hover:bg-primary"
              onClick={(e) => e.preventDefault()}
            >
              <Plus aria-hidden />
              {tl("newReport")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tl("planBlocked.tooltip")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button asChild>
      <Link href="/reports/new">
        <Plus aria-hidden />
        {tl("newReport")}
      </Link>
    </Button>
  );
}

"use client"; // live integrity check via react-query

import { useTranslations } from "next-intl";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@rakhal/ui/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChainIntegrity } from "../hooks/use-activity";

/**
 * RFE-042's own "hash-chain badge" AC (PRD §19.3: the log is tamper-evident, not just
 * tamper-resistant). Calls the real `GET /activity-log/verify-chain` once per page load
 * (`staleTime` matches the list's own) and shows whether the farm's chain recomputes clean.
 */
export function ChainIntegrityBadge() {
  const t = useTranslations("activity.chainIntegrity");
  const { data, isLoading, isError } = useChainIntegrity();

  if (isLoading) {
    return (
      <Badge variant="secondary" className="gap-1">
        <ShieldQuestion className="size-3.5" />
        {t("checking")}
      </Badge>
    );
  }

  if (isError || !data) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={data.valid ? "success" : "destructive"} className="gap-1">
          {data.valid ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
          {data.valid ? t("verified") : t("broken")}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{data.valid ? t("verifiedHint", { count: data.entries }) : t("brokenHint")}</TooltipContent>
    </Tooltip>
  );
}

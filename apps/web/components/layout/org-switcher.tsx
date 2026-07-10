"use client";

import { ChevronsUpDown, Warehouse } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCurrentFarm } from "@/features/farm/hooks/use-current-farm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Farm switcher for multi-farm accounts. Shows the real farm name/slug via `GET /farms`
 * (`features/farm`) — the backend only exposes the farm list during login bootstrap or this
 * always-available list route; there's no confirmed "switch farm while already logged in" endpoint
 * (only `POST /auth/switch-organization`, which needs an id the client doesn't otherwise have).
 * Flagged as a gap in PROJECT_PROGRESS.md's RFE-005 entry — this renders the current farm read-only
 * until that endpoint exists. No location/address field exists on the farm model; `slug` is the
 * closest secondary identifier.
 */
export function OrgSwitcher() {
  const t = useTranslations("farmSelector");
  const { farm, farmId, isLoading, isError } = useCurrentFarm();

  if (isLoading) {
    return <Skeleton className="h-[52px] w-full bg-sidebar-foreground/10" />;
  }

  const name = farm?.name ?? (isError ? `Farm ${farmId ?? ""}` : "—");
  const secondary = farm?.slug ?? farmId ?? "";

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label={`${name} — ${t("switchHint")}`}
            className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-card-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-hover">
              <Warehouse className="size-[18px]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{secondary}</p>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("yourFarm")}</DropdownMenuLabel>
        <DropdownMenuItem disabled>{name}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>{t("switchComingSoon")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { Check, ChevronsUpDown, Warehouse } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCurrentFarm } from "@/features/farm/hooks/use-current-farm";
import { useSwitchFarm } from "@/features/farm/hooks/use-switch-farm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@rakhal/ui/ui/skeleton";

/**
 * Farm switcher for multi-farm accounts. Lists every farm the caller is a member of (`GET /farms`,
 * `features/farm`) and switches the active one via `useSwitchFarm` (`POST /api/auth/select-farm` →
 * backend `/auth/refresh`, same mechanism the login-time multi-farm picker already used — now also
 * reachable post-login). Single-farm accounts see their one farm, non-clickable.
 */
export function OrgSwitcher() {
  const t = useTranslations("farmSelector");
  const { farm, farmId, farms, isLoading, isError } = useCurrentFarm();
  const switchFarm = useSwitchFarm();

  if (isLoading) {
    return <Skeleton className="h-[52px] w-full bg-sidebar-foreground/10" />;
  }

  const name = farm?.name ?? (isError ? `Farm ${farmId ?? ""}` : "—");
  const secondary = farm?.slug ?? farmId ?? "";
  const hasMultipleFarms = farms.length > 1;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label={`${name} — ${t("switchHint")}`}
            disabled={switchFarm.isPending}
            className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-card-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-hover">
              <Warehouse className="size-[18px]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {switchFarm.isPending ? t("switching") : name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{secondary}</p>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{hasMultipleFarms ? t("yourFarms") : t("yourFarm")}</DropdownMenuLabel>
        {farms.map((f) => (
          <DropdownMenuItem
            key={f.id}
            disabled={f.id === farmId || switchFarm.isPending}
            onSelect={() => {
              if (f.id !== farmId) switchFarm.mutate(f.id);
            }}
            className="flex items-center justify-between gap-2"
          >
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            {f.id === farmId && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
        {!hasMultipleFarms && (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("onlyOneFarm")}</p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

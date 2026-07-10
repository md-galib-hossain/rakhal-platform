"use client";

import { ChevronsUpDown } from "lucide-react";
import { useSession } from "@/lib/auth/use-session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Farm switcher for multi-farm accounts. The backend only exposes the farm list during the
 * login bootstrap step (see `features/auth/types.ts#FarmOption`) — there is no confirmed
 * "list my farms while already logged in" GET endpoint (only `POST /auth/switch-organization`,
 * which needs an id we don't have post-login). Flagged as a gap in PROJECT_PROGRESS.md's RFE-005
 * entry rather than guessed at; this renders the current farm read-only until that endpoint exists.
 */
export function OrgSwitcher() {
  const { data: session, isLoading } = useSession();

  if (isLoading) {
    return <Skeleton className="h-10 w-full bg-sidebar-foreground/10" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-left text-card-foreground shadow-xs transition-colors hover:bg-muted">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{session?.user.name ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">Farm {session?.farmId ?? ""}</p>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your farm</DropdownMenuLabel>
        <DropdownMenuItem disabled>{session?.user.name ?? "—"}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Switch organization (coming soon)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

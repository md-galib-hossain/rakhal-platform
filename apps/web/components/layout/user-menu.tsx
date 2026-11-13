"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, LogOut, MessageSquare, Settings, UserRound } from "lucide-react";
import { useLogout, useSession } from "@/lib/auth/use-session";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@rakhal/ui/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FeedbackDialog } from "@/features/support/components/feedback-dialog";
import { LanguageToggleItem } from "./language-toggle-item";

function initialsOf(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Single account menu, topbar-only — always visible regardless of sidebar/Sheet state, the
 * conventional location for account actions. (A sidebar-footer copy existed briefly to give the
 * upgrade ad a resting state to overlay; removed as a redundant duplicate — the ad now just
 * anchors to the sidebar's own bottom edge instead.) */
export function UserMenu() {
  const { data: session } = useSession();
  const t = useTranslations("topbar");
  const name = session?.user.name;
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label={`${name ?? t("profile")} — ${t("accountMenuHint")}`}
            className="flex h-10 items-center gap-2 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2 shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="size-9">
              <AvatarFallback>{initialsOf(name)}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-28 truncate text-sm font-medium xl:inline">{name ?? "—"}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("accountMenuHint")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="truncate font-medium">{session?.user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{session?.user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-2 text-sm">
          <span>{t("onDuty")}</span>
          {/* Real wiring (PATCH /auth/me/on-duty) is RFE-007's lane — shell shows the control only. */}
          <Switch disabled aria-label={t("onDuty")} />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound className="size-4" /> {t("profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" /> {t("accountSettings")}
          </Link>
        </DropdownMenuItem>
        <LanguageToggleItem />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            setFeedbackOpen(true);
          }}
        >
          <MessageSquare className="size-4" /> {t("feedback")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <LogoutMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
    <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}

function LogoutMenuItem() {
  const t = useTranslations("topbar");
  const logout = useLogout();
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        logout.mutate();
      }}
      disabled={logout.isPending}
      className="text-destructive focus:text-destructive"
    >
      <LogOut className="size-4" /> {t("logout")}
    </DropdownMenuItem>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@rakhal/ui/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rakhal/ui/ui/dropdown-menu";
import { postJson } from "@/lib/api/browser";
import { humanizeEnum } from "@/lib/format";

/** Account menu, topbar-only: same trigger and menu chrome as the consumer app. */
export function UserMenu({ email, role }: { email: string; role: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await postJson("/api/auth/logout");
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${email}`}
        className="flex h-10 items-center gap-2 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2 shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-9">
          <AvatarFallback>{email.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-36 truncate text-sm font-medium xl:inline">{email}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="truncate font-medium">{email}</p>
          <p className="text-xs font-normal capitalize text-muted-foreground">{humanizeEnum(role)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/change-password">
            <KeyRound className="size-4" /> Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
          disabled={pending}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" /> {pending ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

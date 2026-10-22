"use client"; // owns the mobile Sheet's open state

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@rakhal/ui/ui/sheet";
import rakhalLogo from "@/public/logo-mark.svg";
import { SidebarNav } from "./sidebar-nav";

function SidebarBody({ permissions, onNavigate }: { permissions: readonly string[]; onNavigate?: () => void }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-72 -translate-x-1/2 bg-primary/20 blur-3xl"
      />
      <div className="relative flex items-center gap-2 border-b border-primary-hover/60 px-4 py-5">
        <Link href="/" className="block h-9 w-28 shrink-0 overflow-hidden" aria-label="Rakhal Admin home">
          <Image src={rakhalLogo} alt="Rakhal" className="h-full w-full object-cover object-left" priority />
        </Link>
        <span className="rounded-full bg-sidebar-foreground/15 px-2 py-0.5 text-xs font-semibold text-sidebar-foreground">
          Admin
        </span>
      </div>
      <div className="sidebar-scrollbar relative flex flex-1 flex-col overflow-y-auto px-4 py-5">
        <SidebarNav permissions={permissions} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/** Desktop floating sidebar, always visible from `lg`. */
export function Sidebar({ permissions }: { permissions: readonly string[] }) {
  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="sticky top-2.5 z-30 h-[calc(100vh-1.25rem)]">
        <SidebarBody permissions={permissions} />
      </div>
    </aside>
  );
}

/** Mobile sidebar: a Sheet opened from the topbar's menu button, below `lg`. */
export function MobileSidebar({ permissions }: { permissions: readonly string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation menu">
        <Menu className="size-5" />
      </Button>
      <SheetContent side="left" className="w-72 border-none bg-transparent p-2.5" showClose={false}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarBody permissions={permissions} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

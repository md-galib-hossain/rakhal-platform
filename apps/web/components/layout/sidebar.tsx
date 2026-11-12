"use client"; // owns the mobile Sheet's open state

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";
import { OrgSwitcher } from "./org-switcher";
import { UpgradeAd } from "./upgrade-ad";
import rakhalLogo from "@/public/auth/logo-mark.svg";

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground">
      {/* Decorative bottom glow — stands in for the Figma frame's two blurred polygon layers. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-72 -translate-x-1/2 bg-primary/20 blur-3xl"
      />
      <div className="relative flex items-center border-b border-primary-hover/60 px-4 py-5">
        <Link href="/dashboard" className="block h-9 w-full max-w-[160px] overflow-hidden">
          <Image src={rakhalLogo} alt="Rakhal" className="h-full w-full object-cover object-left" priority />
        </Link>
      </div>
      <div className="sidebar-scrollbar relative flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
        <OrgSwitcher />
        <SidebarNav onNavigate={onNavigate} />
      </div>
      {/* Account access lives only in the topbar (UserMenu) — no sidebar duplicate. The ad
       * (upgrade-ad.tsx) periodically slides up from here, over the bottom of the nav list. */}
      <UpgradeAd />
    </div>
  );
}

/** Desktop fixed sidebar — always visible ≥ `lg`. */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      {/* z-30 matches Topbar's own z-index — keeps it unambiguously above AppShell's z-20
          scroll-fog scrim, which otherwise has no explicit stacking relationship with this
          sticky-but-unindexed sidebar. */}
      <div className="sticky top-2.5 z-30 h-[calc(100vh-1.25rem)]">
        <SidebarBody />
      </div>
    </aside>
  );
}

/** Mobile sidebar — a Sheet triggered by the topbar's menu button, < `lg`. */
export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </Button>
      <SheetContent side="left" className="w-72 border-none bg-transparent p-2.5" showClose={false}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarBody onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

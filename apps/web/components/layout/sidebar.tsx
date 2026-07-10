"use client"; // owns the mobile Sheet's open state

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";
import { OrgSwitcher } from "./org-switcher";
import { UpgradeBanner } from "./upgrade-banner";

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground">
      {/* Decorative bottom glow — stands in for the Figma frame's two blurred polygon layers. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />
      <div className="relative flex items-center gap-2 border-b border-primary-hover/60 px-4 py-5">
        <div className="size-7 shrink-0 rounded-lg bg-primary" aria-hidden />
        <Link href="/dashboard" className="text-2xl font-bold tracking-tight text-primary">
          Rakhal
        </Link>
      </div>
      <div className="relative flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
        <OrgSwitcher />
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="relative px-4 pb-4">
        <UpgradeBanner />
      </div>
    </div>
  );
}

/** Desktop fixed sidebar — always visible ≥ `lg`. */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="sticky top-2.5 h-[calc(100vh-1.25rem)]">
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

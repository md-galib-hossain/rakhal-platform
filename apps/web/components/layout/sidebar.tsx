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
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-5">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          Rakhal
        </Link>
      </div>
      <div className="px-3">
        <OrgSwitcher />
      </div>
      <SidebarNav onNavigate={onNavigate} />
      <UpgradeBanner />
    </div>
  );
}

/** Desktop fixed sidebar — always visible ≥ `lg`. */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="fixed inset-y-0 w-64">
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
      <SheetContent side="left" className="w-72 p-0" showClose={false}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarBody onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

"use client"; // active-route highlighting needs the client pathname

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

export interface SidebarNavProps {
  /** Called after a link is clicked — the mobile Sheet uses this to close itself. */
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label={t("menu")}>
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
              active && "bg-sidebar-foreground/15 text-sidebar-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="truncate">{t(item.labelKey)}</span>
            {item.premiumFlag ? (
              <span className="ml-auto rounded-full bg-sidebar-muted/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sidebar-muted">
                Pro
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

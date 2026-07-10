"use client"; // active-route highlighting needs the client pathname

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { navItems, type NavItem } from "./nav-items";

export interface SidebarNavProps {
  /** Called after a link is clicked — the mobile Sheet uses this to close itself. */
  onNavigate?: () => void;
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium text-sidebar-foreground/90 transition-colors hover:bg-sidebar-foreground/10",
        active && "bg-card text-primary-hover hover:bg-card",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className="truncate">{t(item.labelKey)}</span>
      {item.premiumFlag ? (
        <span className="ml-auto rounded-full bg-sidebar-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sidebar-muted">
          Pro
        </span>
      ) : null}
    </Link>
  );
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const menuItems = navItems.filter((item) => item.section === "menu");
  const otherItems = navItems.filter((item) => item.section === "others");

  return (
    <nav className="flex flex-1 flex-col gap-5" aria-label={t("menu")}>
      <div className="flex flex-col gap-3">
        <p className="px-4 text-xs font-bold uppercase tracking-wide text-sidebar-muted">{t("menu")}</p>
        <div className="flex flex-col gap-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              onNavigate={onNavigate}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="px-4 text-xs font-bold uppercase tracking-wide text-sidebar-muted">{t("others")}</p>
        <div className="flex flex-col gap-1">
          {otherItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              onNavigate={onNavigate}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

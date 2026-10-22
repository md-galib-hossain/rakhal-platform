"use client"; // active-route highlighting needs the client pathname

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@rakhal/ui/lib/utils";
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/nav-config";
import { canDo } from "@/lib/permissions";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Grouped nav, same chrome as the consumer app's sidebar. Icons live in the client bundle, so only the permission list crosses the boundary. */
export function SidebarNav({ permissions, onNavigate }: { permissions: readonly string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5">
      {NAV_GROUPS.map((group) => {
        const items = NAV_ITEMS.filter((i) => i.group === group.key && canDo(permissions, i.perm));
        if (items.length === 0) return null;
        return (
          <div key={group.key} className="flex flex-col gap-1.5">
            <p className="px-4 py-1 text-xs font-bold uppercase tracking-wide text-sidebar-muted">{group.label}</p>
            {items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg py-2.5 pl-[18px] pr-3.5 text-sm font-medium text-sidebar-foreground/80 transition-colors",
                    "hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                    active && "bg-primary/25 text-sidebar-foreground hover:bg-primary/25",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-1.5 left-0 w-[3px] rounded-full", active ? "bg-primary" : "bg-transparent")}
                  />
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

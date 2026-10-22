import Link from "next/link";
import { NAV_ITEMS } from "@/lib/nav-config";
import { canDo } from "@/lib/permissions";

export function AdminShell({
  permissions,
  children,
}: {
  permissions: readonly string[];
  children: React.ReactNode;
}) {
  const items = NAV_ITEMS.filter((i) => canDo(permissions, i.perm));
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 bg-sidebar p-4 text-sidebar-foreground md:block">
        <div className="mb-6 text-lg font-semibold">Rakhal Admin</div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white/10"
            >
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}

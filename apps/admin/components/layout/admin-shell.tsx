import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NAV_ITEMS } from "@/lib/nav-config";
import { canDo } from "@/lib/permissions";

export function AdminShell({
  permissions,
  email,
  role,
  children,
}: {
  permissions: readonly string[];
  email: string;
  role: string;
  children: React.ReactNode;
}) {
  const items = NAV_ITEMS.filter((i) => canDo(permissions, i.perm));
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
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
        <div className="mt-auto space-y-2 border-t border-white/15 pt-3">
          <div className="px-3 text-xs text-sidebar-muted">
            <p className="truncate" title={email}>
              {email}
            </p>
            <p>{role.replace("_", " ").toLowerCase()}</p>
          </div>
          <Link href="/change-password" className="block rounded-md px-3 py-2 text-sm hover:bg-white/10">
            Change password
          </Link>
          <SignOutButton />
        </div>
      </aside>

      <header className="bg-sidebar text-sidebar-foreground md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold">Rakhal Admin</span>
          <div className="w-28">
            <SignOutButton />
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm hover:bg-white/10"
            >
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}

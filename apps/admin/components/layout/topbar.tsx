import { MobileSidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/** Translucent + backdrop-blur so it reads as one frosted surface with the shell's scroll scrim. */
export function Topbar({ permissions, email, role }: { permissions: readonly string[]; email: string; role: string }) {
  return (
    <header className="sticky top-2.5 z-30 flex h-16 items-center gap-3 rounded-2xl border border-border bg-card/80 p-2.5 backdrop-blur-md">
      <MobileSidebar permissions={permissions} />
      <span className="text-sm font-semibold text-foreground lg:hidden">Rakhal Admin</span>
      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <UserMenu email={email} role={role} />
      </div>
    </header>
  );
}

import { MobileSidebar } from "./sidebar";
// import { GlobalSearch } from "./global-search";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Translucent + `backdrop-blur` (not a fully opaque fill) so it reads as one continuous frosted
 * surface with `AppShell`'s scroll scrim behind it — see that file's header comment.
 */
export function Topbar() {
  return (
    <header className="sticky top-2.5 z-30 flex h-16 items-center gap-3 rounded-2xl border border-border bg-card/80 p-2.5 backdrop-blur-md">
      <MobileSidebar />
      {/* Global search hidden for v1 release
      <GlobalSearch /> */}
      <div className="ml-auto flex items-center gap-3">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

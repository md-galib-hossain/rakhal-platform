import { MobileSidebar } from "./sidebar";
import { GlobalSearch } from "./global-search";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Topbar() {
  return (
    <header className="sticky top-2.5 z-30 flex h-14 items-center gap-3 rounded-2xl border border-border bg-background p-2.5">
      <MobileSidebar />
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-3">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

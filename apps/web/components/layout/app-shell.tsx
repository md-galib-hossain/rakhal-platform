import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** PRD §6.1/§6.2 — sidebar (desktop) + Sheet (mobile) + topbar, wraps every `(app)` route. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

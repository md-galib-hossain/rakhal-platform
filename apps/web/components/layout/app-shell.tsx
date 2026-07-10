import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * PRD §6.1/§6.2 — sidebar (desktop) + Sheet (mobile) + topbar, wraps every `(app)` route.
 * Pixel-matched against the Figma "Dashboard" frame (file SCfMPdxP6vgW1uTxfqCtz7, node 732:1656,
 * RFE-005 pixel-exact pass): both the sidebar and topbar float as separate rounded cards on a
 * shared page gutter, rather than a flush full-bleed shell.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen gap-2.5 bg-background p-2.5">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <Topbar />
        <main className="flex-1 p-1 sm:p-2">{children}</main>
      </div>
    </div>
  );
}

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * Same shell as the consumer app: sidebar and topbar float as separate rounded cards on a shared gutter,
 * with a blurred scrim pinned to the viewport top so scrolled content fogs out before the sticky topbar.
 * `lg:left-[16.25rem]` = shell padding (0.625rem) + sidebar (15rem) + gap (0.625rem).
 */
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
  return (
    <div className="flex min-h-dvh gap-2.5 bg-background p-2.5">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-20 h-28 lg:left-[16.25rem]">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/75 to-transparent" />
        <div className="absolute inset-0 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_0%,black_25%,transparent_65%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_25%,transparent_65%)]" />
      </div>
      <Sidebar permissions={permissions} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <Topbar permissions={permissions} email={email} role={role} />
        <main className="flex-1 p-1 sm:p-2">{children}</main>
      </div>
    </div>
  );
}

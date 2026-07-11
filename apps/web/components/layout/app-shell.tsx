import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ReadOnlyBanner } from "./read-only-banner";

/**
 * PRD §6.1/§6.2 — sidebar (desktop) + Sheet (mobile) + topbar, wraps every `(app)` route.
 * Pixel-matched against the Figma "Dashboard" frame (file SCfMPdxP6vgW1uTxfqCtz7, node 732:1656,
 * RFE-005 pixel-exact pass): both the sidebar and topbar float as separate rounded cards on a
 * shared page gutter, rather than a flush full-bleed shell. `ReadOnlyBanner` (RFE-008) renders
 * nothing when the subscription is usable — a no-op `<Client Component>` child of this Server
 * Component, doesn't need `AppShell` itself to become client.
 *
 * **Frosted-glass scroll scrim (2026-07-11, user request):** the page (not `main`) is the scroll
 * container — `Topbar` is `sticky top-2.5`, so it only pins once scroll has carried it to that
 * offset, and the `p-2.5` gutter above it is normal (non-sticky) flow, not fixed — so once you
 * scroll, `main`'s own content is what's visible immediately above the sticky topbar in that
 * gutter, giving a hard, unpolished edge instead of a fade. Fixed with a `pointer-events-none`
 * blurred scrim pinned to the viewport top (`fixed`, not `sticky`, so it doesn't scroll away with
 * the rest of the shell), `backdrop-blur` + a `background`→transparent gradient so scrolled
 * content fogs out before it reaches the topbar rather than cutting off sharply. `lg:left-...`
 * offset math: AppShell's own `p-2.5` (0.625rem) + `Sidebar`'s `w-60` (15rem) + the `gap-2.5`
 * between them (0.625rem) = `16.25rem` — matches `Sidebar`'s own `h-[calc(100vh-1.25rem)]`
 * precedent of hand-computed layout constants. `Topbar` itself also went from a fully opaque
 * `bg-background` to a translucent `bg-background/80 backdrop-blur-md` glass card so it reads as
 * one continuous frosted surface with the scrim behind it, not two different treatments stacked.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen gap-2.5 bg-background p-2.5">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-20 h-28 lg:left-[16.25rem]"
      >
        {/* Background fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/75 to-transparent" />

        {/* Strong blur near the top */}
        <div
          className="
            absolute inset-0
            backdrop-blur-xl
            [mask-image:linear-gradient(to_bottom,black_0%,black_25%,transparent_65%)]
            [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_25%,transparent_65%)]
          "
        />

        {/* Softer blur extending farther down */}
        <div
          className="
            absolute inset-0
            backdrop-blur-sm
            [mask-image:linear-gradient(to_bottom,black_20%,black_55%,transparent_100%)]
            [-webkit-mask-image:linear-gradient(to_bottom,black_20%,black_55%,transparent_100%)]
          "
        />
      </div>

      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <Topbar />
        <ReadOnlyBanner />

        <main className="flex-1 p-1 sm:p-2">{children}</main>
      </div>
    </div>
  );
}
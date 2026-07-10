import Link from "next/link";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/**
 * Shared split-panel chrome for every `(auth)` page. No Figma auth frames exist yet
 * (DESIGN_SYSTEM.md §1 resolution-path 3 — PRD-as-spec fallback): this reuses the landing
 * page's established brand panel language (dark sidebar-green, cream accents) rather than
 * inventing new visual language.
 */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-sidebar-foreground/5"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-sidebar-foreground/5"
        />
        <Link href="/" className="relative text-2xl font-bold">
          রাখাল
        </Link>
        <div className="relative space-y-4">
          <p className="max-w-sm text-3xl font-bold leading-tight">{title}</p>
          {description ? <p className="max-w-sm text-sidebar-foreground/70">{description}</p> : null}
        </div>
        <p className="relative text-sm text-sidebar-foreground/50">
          © {new Date().getFullYear()} Rakhal — smart dairy management for Bangladesh.
        </p>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6">
          <Link href="/" className="text-lg font-bold text-primary lg:hidden">
            রাখাল
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

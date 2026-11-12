import Image from "next/image";
import Link from "next/link";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import rakhalLogo from "@/public/logo-mark.svg";

/**
 * Wizard chrome for onboarding Steps 2–4 (configure/cattle/team) — `AuthShell`'s 453px split-panel
 * card (built for a single form field) is too narrow for a sheds list + stepper, so this is a
 * separate, wider centered card. PRD-spec (no Figma onboarding frames exist yet, per
 * `docs/PROJECT_PROGRESS.md` RFE-047), reuses `AuthShell`'s established top-bar toggles.
 */
export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="flex items-center justify-between p-6">
        <Link href="/" className="block h-8 w-[130px]">
          <Image src={rakhalLogo} alt="Rakhal" className="h-full w-full object-cover object-left" />
        </Link>
        <div className="flex items-center gap-1">
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </div>
      <main className="flex flex-1 items-start justify-center p-2.5 pb-16">
        <div className="w-full max-w-2xl rounded-[20px] bg-card p-6 shadow-[0px_12px_16px_rgba(0,0,0,0.12)] sm:p-[30px]">
          {children}
        </div>
      </main>
    </div>
  );
}

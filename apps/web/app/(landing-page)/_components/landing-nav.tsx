import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LocaleToggle } from "./locale-toggle";

export function LandingNav() {
  const t = useTranslations("landing.nav");
  const tc = useTranslations("common");

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-primary">
            <span className="size-3.5 rounded-sm bg-primary-foreground/90" />
          </span>
          <span className="text-lg font-bold tracking-tight">{tc("appName")}</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a className="transition-colors hover:text-foreground" href="#features">
            {t("features")}
          </a>
          <a className="transition-colors hover:text-foreground" href="#pricing">
            {t("pricing")}
          </a>
          <a className="transition-colors hover:text-foreground" href="#faq">
            {t("faq")}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleToggle />
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">{t("login")}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">{t("trial")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

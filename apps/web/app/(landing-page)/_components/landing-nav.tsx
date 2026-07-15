import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { LocaleToggle } from "./locale-toggle";
import rakhalLogo from "@/public/logo-mark.svg";

export function LandingNav() {
  const t = useTranslations("landing.nav");

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="block h-9 w-[150px] overflow-hidden rounded-lg">
          <Image src={rakhalLogo} alt="Rakhal" className="h-full w-full object-cover object-left" priority />
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
            <a href={`${env.NEXT_PUBLIC_FARM_URL}/login`}>{t("login")}</a>
          </Button>
          <Button size="sm" asChild>
            <a href={`${env.NEXT_PUBLIC_FARM_URL}/register`}>{t("trial")}</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

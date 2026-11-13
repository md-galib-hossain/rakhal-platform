import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@rakhal/ui/ui/button";
import { env } from "@/lib/env";
import { Reveal } from "./motion";

export function FinalCta() {
  const t = useTranslations("landing.cta");

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-sidebar px-8 py-16 text-center text-sidebar-foreground sm:px-16 sm:py-20">
            <div aria-hidden className="absolute inset-0">
              <div className="absolute -top-24 left-1/4 size-72 rounded-full bg-primary/30 blur-3xl" />
              <div className="absolute -bottom-24 right-1/4 size-72 rounded-full bg-warning/20 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">{t("title")}</h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-sidebar-muted">{t("body")}</p>
              <div className="mt-9 flex flex-wrap justify-center gap-4">
                <Button size="lg" asChild>
                  <a href={`${env.NEXT_PUBLIC_FARM_URL}/register`}>
                    {t("buy")}
                    <ArrowRight aria-hidden />
                  </a>
                </Button>
                {/* TODO(landing): point at the real demo-booking flow (calendar/contact) when one exists. */}
                <Button size="lg" variant="inverse" asChild>
                  <a href="mailto:hello@rakhal.app">{t("demo")}</a>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

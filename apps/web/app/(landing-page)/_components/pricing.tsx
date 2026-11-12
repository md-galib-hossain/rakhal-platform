import { Check } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

/**
 * TODO(landing → backend): plan names/prices should eventually come from the public
 * `GET /plans` endpoint so marketing never drifts from real billing (PRD §31).
 */
const PLANS = [
  { key: "starter", features: ["F1", "F2", "F3"], highlight: false, href: `${env.NEXT_PUBLIC_FARM_URL}/register` },
  { key: "growth", features: ["F1", "F2", "F3", "F4"], highlight: true, href: `${env.NEXT_PUBLIC_FARM_URL}/register` },
  { key: "enterprise", features: ["F1", "F2", "F3"], highlight: false, href: "mailto:hello@rakhal.app" },
] as const;

export function Pricing() {
  const t = useTranslations("landing.pricing");

  return (
    <section id="pricing" className="scroll-mt-16 bg-background">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <SectionHeading kicker={t("kicker")} title={t("title")} />
        </Reveal>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map(({ key, features, highlight, href }, i) => (
            <Reveal key={key} delay={i * 0.1} className="h-full">
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border bg-card p-7 shadow-sm",
                  highlight ? "border-primary shadow-xl shadow-primary/10 ring-1 ring-primary" : "border-border",
                )}
              >
                {highlight ? (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground">
                    {t("growthBadge")}
                  </span>
                ) : null}
                <h3 className="text-lg font-bold">{t(`${key}Name`)}</h3>
                <p className="mt-3">
                  <span className="text-4xl font-bold">{t(`${key}Price`)}</span>
                  <span className="text-muted-foreground">{t(`${key}Period`)}</span>
                </p>
                <p className="mt-3 text-muted-foreground">{t(`${key}Desc`)}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                      {t(`${key}${f}`)}
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full" variant={highlight ? "primary" : "secondary"} asChild>
                  <Link href={href}>{t(`${key}Cta`)}</Link>
                </Button>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

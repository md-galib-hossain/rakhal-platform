import { useTranslations } from "next-intl";
import { Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

const STEPS = ["s1", "s2", "s3", "s4"] as const;

export function Onboarding() {
  const t = useTranslations("landing.steps");

  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <SectionHeading kicker={t("kicker")} title={t("title")} />
        </Reveal>

        <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Connector line behind the step markers (desktop). */}
          <div aria-hidden className="absolute left-0 right-0 top-6 hidden h-px bg-border lg:block" />
          {STEPS.map((step, i) => (
            <Reveal key={step} delay={i * 0.1}>
              <li className="relative">
                <span className="relative z-10 grid size-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/25">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-lg font-bold">{t(`${step}Title`)}</h3>
                <p className="mt-2 text-muted-foreground">{t(`${step}Desc`)}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

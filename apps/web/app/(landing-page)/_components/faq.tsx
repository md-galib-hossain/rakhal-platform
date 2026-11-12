import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

const QUESTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Native <details> accordion — zero JS, keyboard-accessible, and the answers stay in the HTML for SEO. */
export function Faq() {
  const t = useTranslations("landing.faq");

  return (
    <section id="faq" className="scroll-mt-16 bg-cream">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <Reveal>
          <SectionHeading kicker={t("kicker")} title={t("title")} />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
            {QUESTIONS.map((i) => (
              <details key={i} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {t(`q${i}`)}
                  <ChevronDown
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="mt-3 text-muted-foreground">{t(`a${i}`)}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

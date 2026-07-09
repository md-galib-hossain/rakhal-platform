import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

const ITEMS = [1, 2, 3] as const;

export function Testimonials() {
  const t = useTranslations("landing.testimonials");

  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <SectionHeading kicker={t("kicker")} title={t("title")} />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {ITEMS.map((i, idx) => (
            <Reveal key={i} delay={idx * 0.1}>
              <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div aria-hidden className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-4 fill-warning text-warning" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-foreground">
                  <p>“{t(`q${i}`)}”</p>
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span aria-hidden className="grid size-10 place-items-center rounded-full bg-success-tint font-bold text-primary">
                    {t(`r${i}`).charAt(0)}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">— {t(`r${i}`)}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

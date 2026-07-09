import { Baby, BarChart3, Beef, HeartPulse, Milk, Users, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { MockBars } from "./mock-bits";
import { Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

const FEATURES = [
  { key: "f1", icon: Beef, tint: "bg-success-tint text-primary", bars: false },
  { key: "f2", icon: Milk, tint: "bg-info-tint text-info", bars: true },
  { key: "f3", icon: HeartPulse, tint: "bg-destructive-tint text-destructive", bars: false },
  { key: "f4", icon: Baby, tint: "bg-accent-purple-tint text-accent-purple", bars: false },
  { key: "f5", icon: Wallet, tint: "bg-warning-tint text-warning", bars: true },
  { key: "f6", icon: BarChart3, tint: "bg-accent-indigo-tint text-accent-indigo", bars: true },
  { key: "f7", icon: Users, tint: "bg-accent-teal-tint text-accent-teal", bars: false },
] as const;

export function Features() {
  const t = useTranslations("landing.features");

  return (
    <section id="features" className="scroll-mt-16 bg-background">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[1fr_1.4fr]">
        {/* Sticky rail keeps the section title pinned while the feature cards scroll past. */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <SectionHeading kicker={t("kicker")} title={t("title")} subtitle={t("subtitle")} align="left" />
          </Reveal>
        </div>

        <div className="space-y-5">
          {FEATURES.map(({ key, icon: Icon, tint, bars }, i) => (
            <Reveal key={key} delay={Math.min(i * 0.05, 0.2)}>
              <article className="flex gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${tint}`}>
                  <Icon aria-hidden className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold">{t(`${key}Title`)}</h3>
                  <p className="mt-1.5 text-muted-foreground">{t(`${key}Desc`)}</p>
                </div>
                {bars ? <MockBars values={[45, 70, 55, 85, 65]} className="hidden h-14 w-24 shrink-0 self-center sm:flex" /> : null}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

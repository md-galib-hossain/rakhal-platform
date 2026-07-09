import { Baby, BarChart3, Beef, HeartPulse, Milk, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { MockBars, MockStat } from "./mock-bits";
import { Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

const MODULES = [
  { key: "m1", icon: Beef, tint: "bg-success-tint text-primary" },
  { key: "m2", icon: Milk, tint: "bg-info-tint text-info" },
  { key: "m3", icon: HeartPulse, tint: "bg-destructive-tint text-destructive" },
  { key: "m4", icon: Baby, tint: "bg-accent-purple-tint text-accent-purple" },
  { key: "m5", icon: Wallet, tint: "bg-warning-tint text-warning" },
  { key: "m6", icon: BarChart3, tint: "bg-accent-indigo-tint text-accent-indigo" },
] as const;

export function Solution() {
  const t = useTranslations("landing.solution");
  const td = useTranslations("landing.dashboard");

  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <SectionHeading kicker={t("kicker")} title={t("title")} subtitle={t("body")} />
        </Reveal>

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          {/* Module chips */}
          <div className="grid grid-cols-2 gap-4">
            {MODULES.map(({ key, icon: Icon, tint }, i) => (
              <Reveal key={key} delay={i * 0.06}>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tint}`}>
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="font-semibold">{t(key)}</span>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Compact dashboard mock */}
          <Reveal delay={0.2} aria-hidden>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xl shadow-primary/5">
              <div className="flex items-center gap-1.5 border-b border-border pb-3">
                <span className="size-2.5 rounded-full bg-destructive/60" />
                <span className="size-2.5 rounded-full bg-warning/60" />
                <span className="size-2.5 rounded-full bg-primary/60" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MockStat label={td("totalCattle")} value="120" delta="+4.5%" />
                <MockStat label={td("milkToday")} value="448L" delta="+4.5%" />
              </div>
              <div className="mt-3 rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground">{td("monthly")}</p>
                <MockBars values={[40, 62, 48, 75, 58, 88, 70, 52, 80, 66, 92, 74]} className="mt-3" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

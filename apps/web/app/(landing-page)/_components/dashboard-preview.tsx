import { Activity, Baby, HeartPulse, Milk } from "lucide-react";
import { useTranslations } from "next-intl";
import { MockBars, MockStat } from "./mock-bits";
import { ParallaxY, Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

export function DashboardPreview() {
  const t = useTranslations("landing.dashboard");

  return (
    <section className="relative overflow-hidden bg-sidebar">
      <div aria-hidden className="absolute inset-0">
        <div className="absolute left-1/2 top-[-30%] size-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <SectionHeading kicker={t("kicker")} title={t("title")} subtitle={t("subtitle")} tone="dark" />
        </Reveal>

        <div aria-hidden className="mt-14 rounded-3xl border border-sidebar-foreground/10 bg-sidebar-foreground/5 p-4 backdrop-blur-sm sm:p-6">
          {/* Stat row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                { label: t("totalCattle"), value: "120", delta: "+4.5%" },
                { label: t("milkToday"), value: "448L", delta: "+4.5%" },
                { label: t("healthAlerts"), value: "2", tone: "warn" },
                { label: t("pregnancy"), value: "18", tone: "good" },
              ] as const
            ).map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08}>
                <MockStat dark label={s.label} value={s.value} delta={"delta" in s ? s.delta : undefined} tone={"tone" in s ? s.tone : "default"} />
              </Reveal>
            ))}
          </div>

          {/* Chart + right rail with parallax depth between the columns */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <ParallaxY from={24} to={-12}>
              <Reveal delay={0.15}>
                <div className="rounded-xl border border-sidebar-foreground/10 bg-sidebar-foreground/5 p-5">
                  <p className="text-xs font-medium text-sidebar-muted">{t("monthly")}</p>
                  <MockBars
                    values={[38, 55, 47, 68, 58, 82, 64, 50, 76, 62, 90, 71]}
                    className="mt-4 h-36"
                    barClassName="bg-primary/70"
                  />
                </div>
              </Reveal>
            </ParallaxY>

            <ParallaxY from={48} to={-24}>
              <Reveal delay={0.25}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <MockStat dark label={t("expenses")} value="৳45,000" tone="warn" />
                    <MockStat dark label={t("profit")} value="+৳74,000" tone="good" />
                  </div>
                  <div className="rounded-xl border border-sidebar-foreground/10 bg-sidebar-foreground/5 p-5">
                    <p className="text-xs font-medium text-sidebar-muted">{t("activities")}</p>
                    <ul className="mt-3 space-y-3">
                      {(
                        [
                          { icon: Milk, text: t("activity1") },
                          { icon: HeartPulse, text: t("activity2") },
                          { icon: Baby, text: t("activity3") },
                        ] as const
                      ).map(({ icon: Icon, text }) => (
                        <li key={text} className="flex items-center gap-2.5 text-sm text-sidebar-foreground/90">
                          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-sidebar-foreground/10">
                            <Icon className="size-3.5 text-sidebar-muted" />
                          </span>
                          {text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            </ParallaxY>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-sidebar-foreground/10 bg-sidebar-foreground/5 px-5 py-3 text-xs text-sidebar-muted">
            <Activity className="size-3.5" />
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-sidebar-foreground/10">
              <div className="h-full w-2/3 rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

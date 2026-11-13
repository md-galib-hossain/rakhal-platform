import { ArrowRight, Beef, HeartPulse, Milk, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@rakhal/ui/ui/button";
import { env } from "@/lib/env";
import { MockBars } from "./mock-bits";
import { Float, Reveal } from "./motion";

function GlassCard({
  icon,
  label,
  value,
  accent = "text-primary",
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-sidebar-foreground/15 bg-sidebar-foreground/10 p-4 shadow-2xl shadow-black/20 backdrop-blur-md">
      <div className="flex items-center gap-2 text-sidebar-muted">
        <span className="grid size-7 place-items-center rounded-lg bg-sidebar-foreground/10 [&_svg]:size-4">
          {icon}
        </span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
      {children}
    </div>
  );
}

export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
      {/* Cinematic background: slow-zoom glow layer + dotted field texture (CSS only, no video). */}
      <div aria-hidden className="landing-hero-zoom absolute inset-0">
        <div className="absolute -top-48 right-[-12%] size-[36rem] rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute bottom-[-24%] left-[-12%] size-[32rem] rounded-full bg-warning/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(var(--sidebar-muted)_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.08]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-14 px-6 pb-24 pt-32 lg:grid-cols-[1.1fr_0.9fr] lg:pb-32 lg:pt-44">
        <div>
          <Reveal>
            <span className="inline-block rounded-full border border-sidebar-foreground/25 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-sidebar-muted">
              {t("badge")}
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="mt-6 text-4xl font-bold leading-[1.15] sm:text-5xl lg:text-6xl">{t("title")}</h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-sidebar-muted">{t("subtitle")}</p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button size="lg" asChild>
                <a href={`${env.NEXT_PUBLIC_FARM_URL}/register`}>
                  {t("ctaTrial")}
                  <ArrowRight aria-hidden />
                </a>
              </Button>
              <Button size="lg" variant="inverse" asChild>
                <Link href="#pricing">{t("ctaDemo")}</Link>
              </Button>
            </div>
          </Reveal>
        </div>

        {/* Floating glass dashboard cards — desktop only (mobile stays lean). */}
        <div aria-hidden className="relative hidden min-h-[26rem] lg:block">
          <Float className="absolute left-0 top-0 w-56">
            <GlassCard icon={<Milk />} label={t("cardMilk")} value="448L" accent="text-sidebar-foreground">
              <MockBars values={[45, 65, 50, 80, 60, 90, 72]} className="mt-3 h-10" />
            </GlassCard>
          </Float>
          <Float delay={0.9} className="absolute right-0 top-20 w-48">
            <GlassCard icon={<Beef />} label={t("cardCattle")} value="120" accent="text-sidebar-foreground" />
          </Float>
          <Float delay={1.8} className="absolute bottom-24 left-8 w-48">
            <GlassCard icon={<HeartPulse />} label={t("cardHealth")} value="2" accent="text-warning" />
          </Float>
          <Float delay={2.7} className="absolute bottom-0 right-6 w-56">
            <GlassCard icon={<TrendingUp />} label={t("cardGrowth")} value="+12%" accent="text-chart-1">
              <MockBars values={[30, 42, 38, 55, 62, 78]} className="mt-3 h-10" />
            </GlassCard>
          </Float>
        </div>
      </div>
    </section>
  );
}

import { NotebookPen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

function PaperCard({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 opacity-70 shadow-sm grayscale ${className ?? ""}`}
    >
      <NotebookPen aria-hidden className="size-4 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium text-muted-foreground">{text}</p>
      <div aria-hidden className="mt-3 space-y-1.5">
        <div className="h-1.5 w-4/5 rounded bg-muted-foreground/20" />
        <div className="h-1.5 w-3/5 rounded bg-muted-foreground/20" />
        <div className="h-1.5 w-2/3 rounded bg-destructive/25" />
      </div>
    </div>
  );
}

export function Problem() {
  const t = useTranslations("landing.problem");

  return (
    <section className="bg-background">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 sm:py-28 lg:grid-cols-2">
        <div>
          <Reveal>
            <SectionHeading kicker={t("kicker")} title={t("title")} align="left" />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{t("p1")}</p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{t("p2")}</p>
          </Reveal>
        </div>

        {/* Scattered paper records fading out; the Rakhal card rises over them. */}
        <div className="relative min-h-[22rem]" aria-hidden>
          <Reveal className="absolute left-0 top-0 w-56 -rotate-6">
            <PaperCard text={t("paper1")} />
          </Reveal>
          <Reveal delay={0.1} className="absolute right-4 top-10 w-52 rotate-3">
            <PaperCard text={t("paper2")} />
          </Reveal>
          <Reveal delay={0.2} className="absolute left-10 top-40 w-52 rotate-2">
            <PaperCard text={t("paper3")} />
          </Reveal>
          <Reveal delay={0.35} y={40} className="absolute bottom-0 right-0 w-64">
            <div className="rounded-2xl bg-sidebar p-5 text-sidebar-foreground shadow-2xl shadow-primary/20">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-primary" />
                <p className="text-sm font-bold">{t("solutionCardTitle")}</p>
              </div>
              <p className="mt-2 text-sm text-sidebar-muted">{t("solutionCardBody")}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[70, 45, 85].map((h, i) => (
                  <div key={i} className="flex h-12 items-end rounded-md bg-sidebar-foreground/10 p-1">
                    <div style={{ height: `${h}%` }} className="w-full rounded-sm bg-primary" />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

import { useTranslations } from "next-intl";
import { CountUp } from "./count-up";
import { Reveal } from "./motion";

/**
 * TODO(landing → backend): replace these placeholders with a public stats endpoint
 * (e.g. GET /public/stats) once the backend exposes one. Placeholder numbers must NOT
 * ship to production marketing as-is — tracked in PROJECT_PROGRESS.md RFE-100 notes.
 */
const STATS = [
  { key: "cows", value: 12480 },
  { key: "farms", value: 320 },
  { key: "milkRecords", value: 95000 },
  { key: "healthEvents", value: 8700 },
] as const;

export function Counters() {
  const t = useTranslations("landing.counters");

  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <Reveal>
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {t("title")}
          </p>
        </Reveal>
        <dl className="mt-10 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <Reveal key={stat.key} delay={i * 0.08}>
              <div className="text-center">
                <dd className="text-3xl font-bold text-primary sm:text-4xl">
                  <CountUp value={stat.value} />
                </dd>
                <dt className="mt-2 text-sm font-medium text-muted-foreground">{t(stat.key)}</dt>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

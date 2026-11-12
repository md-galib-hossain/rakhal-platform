import Link from "next/link";
import { AlertTriangle, Baby, Milk, PawPrint, Stethoscope, Wallet, Wheat, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { resolveBackendKey, type ReportTranslator } from "../../lib/labels";
import type { ReportDomain, ReportException } from "../../types";

type Translate = (key: string, values?: Record<string, string | number>) => string;

const DOMAIN_ICON: Record<ReportDomain, LucideIcon> = {
  milk: Milk,
  health: Stethoscope,
  reproduction: Baby,
  feed: Wheat,
  finance: Wallet,
  cow_profile: PawPrint,
};

const DOMAIN_TINT: Record<ReportDomain, { bg: string; text: string }> = {
  milk: { bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
  health: { bg: "bg-rose-500/10 dark:bg-rose-500/20", text: "text-rose-600 dark:text-rose-400" },
  reproduction: { bg: "bg-purple-500/10 dark:bg-purple-500/20", text: "text-purple-600 dark:text-purple-400" },
  feed: { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
  finance: { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
  cow_profile: { bg: "bg-teal-500/10 dark:bg-teal-500/20", text: "text-teal-600 dark:text-teal-400" },
};

/** Things that need attention, in the backend's order. A single affected animal links to it (the cattle drawer). */
export function ExceptionsList({
  exceptions,
  tr,
  t,
}: {
  exceptions: ReportException[];
  tr: ReportTranslator;
  t: Translate;
}) {
  return (
    <section aria-labelledby="report-exceptions-title" className="flex flex-col gap-3">
      <h2 id="report-exceptions-title" className="text-lg font-semibold text-foreground">
        {t("exceptions.title")}
      </h2>
      {exceptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("exceptions.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {exceptions.map((ex, i) => {
            const Icon = DOMAIN_ICON[ex.domain] ?? AlertTriangle;
            const tint = DOMAIN_TINT[ex.domain] ?? { bg: "bg-warning-tint", text: "text-warning" };
            const ids = ex.cattleIds ?? [];
            return (
              <li key={`${ex.code}-${i}`}>
                <Card className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-card hover:border-primary/30 transition-colors">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tint.bg} ${tint.text}`}>
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{resolveBackendKey(ex.messageKey, tr)}</p>
                  {ids.length > 0 ? (
                    <span className="text-xs font-medium text-muted-foreground">{t("exceptions.animals", { count: ids.length })}</span>
                  ) : null}
                  {ids.length === 1 ? (
                    <Link
                      href={`/animals/${encodeURIComponent(ids[0])}`}
                      className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t("exceptions.viewAnimal")}
                    </Link>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

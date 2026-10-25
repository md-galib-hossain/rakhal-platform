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
        <ul className="flex flex-col gap-2">
          {exceptions.map((ex, i) => {
            const Icon = DOMAIN_ICON[ex.domain] ?? AlertTriangle;
            const ids = ex.cattleIds ?? [];
            return (
              <li key={`${ex.code}-${i}`}>
                <Card className="flex flex-wrap items-center gap-3 rounded-xl p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-tint text-warning">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{resolveBackendKey(ex.messageKey, tr)}</p>
                  {ids.length > 0 ? (
                    <span className="text-xs text-muted-foreground">{t("exceptions.animals", { count: ids.length })}</span>
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

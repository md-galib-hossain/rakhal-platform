"use client"; // reads the active lactation

import { useTranslations } from "next-intl";
import { Card } from "@rakhal/ui/ui/card";
import { useActiveLactation } from "@/features/reproduction/hooks/use-reproduction";
import type { CattleDetail } from "../../../types";
import { WS_CARD } from "../workspace-grid";

/** "At a glance" (RFE-186): a quiet key/value card. A row with no value is left out, never shown as a dash. */
export function AtAGlance({ cattle }: { cattle: CattleDetail }) {
  const t = useTranslations("events.workspace.overview.glance");
  const tForm = useTranslations("cattle.form");
  const lactation = useActiveLactation(cattle.gender === "FEMALE" ? cattle.id : undefined).data;
  const rows: [string, string | null | undefined][] = [
    [t("lactation"), lactation ? t("ordinal", { n: lactation.lactationNumber }) : null],
    [t("breed"), cattle.breed?.name],
    [t("pen"), cattle.shed?.name],
    [t("source"), cattle.sourceType && cattle.sourceType !== "UNKNOWN" ? tForm(`sourceTypeOptions.${cattle.sourceType}`) : null],
  ];
  const shown = rows.filter((r): r is [string, string] => Boolean(r[1]));
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="glance-heading" className="flex flex-col gap-2">
      <h2 id="glance-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("title")}
      </h2>
      <Card className={`${WS_CARD} p-0 @min-[480px]/ws:p-0`}>
        <dl className="divide-y divide-border">
          {shown.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
              <dt className="shrink-0 text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words text-right font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </section>
  );
}

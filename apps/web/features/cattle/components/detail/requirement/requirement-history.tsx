"use client"; // the paged history list is mounted lazily, only when the manager opens it

import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { useRequirementOverrideHistory } from "@/features/feed/hooks/use-requirement-override";
import type { RequirementOverrideRow } from "@/features/feed/types";
import { fmt } from "./profile";

/** A row saved before MILESTONE 28b only has DM/CP/ME; a full-profile row has every figure. */
const hasFullProfile = (r: RequirementOverrideRow) => r.ndf_kg != null;

/** Every manual requirement she has had, newest first: dates, who set it, the figures it applied, and what the
 * calculated need was at the time. */
export function RequirementHistory({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.feeding.requirement.history");
  const locale = useLocale() as Locale;
  const pager = useRequirementOverrideHistory(cattleId);

  if (pager.isLoading) return <CardSkeleton lines={3} />;
  if (pager.isError) return <ErrorState onRetry={() => pager.refetch()} />;
  if (pager.items.length === 0) return <p className="text-xs text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {pager.items.map((r) => (
          <li key={r.id} className="rounded-lg border border-border p-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-medium text-foreground">
                {formatDate(r.effective_from, locale)} – {r.effective_to ? formatDate(r.effective_to, locale) : t("now")}
              </span>
              <Badge variant={r.effective_to ? "secondary" : "warning"}>
                {r.end_reason ? t(`end.${r.end_reason}`) : t("current")}
              </Badge>
            </div>
            <p className="mt-1 tabular-nums text-foreground">
              {t("values", { dm: fmt(r.dm_kg), cp: fmt(r.cp_kg), me: fmt(r.me_mj) })}
            </p>
            {hasFullProfile(r) ? (
              <p className="tabular-nums text-foreground">
                {t("valuesMore", {
                  ndf: fmt(r.ndf_kg),
                  ndfMax: fmt(r.ndf_max_kg),
                  adf: fmt(r.adf_kg),
                  fat: fmt(r.fat_kg),
                  tdn: fmt(r.tdn_kg),
                  ca: fmt(r.calcium_kg),
                  p: fmt(r.phosphorus_kg),
                  rdp: fmt(r.rdp_pct),
                  rup: fmt(r.rup_pct),
                })}
              </p>
            ) : (
              <p className="text-muted-foreground">{t("coreOnly")}</p>
            )}
            <p className="tabular-nums text-muted-foreground">
              {t("calculatedThen", {
                dm: fmt(r.dynamic_snapshot.dm_kg),
                cp: fmt(r.dynamic_snapshot.cp_kg),
                me: fmt(r.dynamic_snapshot.me_mj),
              })}
            </p>
            {r.note ? <p className="text-muted-foreground">{r.note}</p> : null}
            {r.set_by_name || r.ended_by_name ? (
              <p className="text-muted-foreground">
                {[
                  r.set_by_name ? t("setBy", { name: r.set_by_name }) : null,
                  r.ended_by_name ? t("endedBy", { name: r.ended_by_name }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {pager.totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={pager.page <= 1} onClick={() => pager.goToPage(pager.page - 1)}>
            {t("newer")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pager.page >= pager.totalPages}
            onClick={() => pager.goToPage(pager.page + 1)}
          >
            {t("older")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

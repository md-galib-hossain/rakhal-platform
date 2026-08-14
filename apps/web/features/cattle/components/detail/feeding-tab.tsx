"use client"; // live queries + quick-feed shortcut dialog state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Wheat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Can } from "@/lib/auth/permissions";
import { useDmi, useResolvedRation } from "@/features/feed/hooks/use-feed";
import { QuickFeedDialog } from "@/features/feed/components/quick-feed-dialog";

const MATCH_LEVEL_VARIANT: Record<string, "success" | "info" | "secondary"> = {
  INDIVIDUAL: "success",
  GROUP: "info",
  HERD: "secondary",
};

/**
 * Cattle-detail Feeding tab (2026-08-13, user request). Shows the cow's resolved active ration
 * (layered targeting — Individual override > Group > Herd default, see `useResolvedRation`) and
 * her actual-vs-expected dry-matter intake (`useDmi`), plus a "Feed this cow now" shortcut
 * pre-targeting `QuickFeedDialog` at this `cattleId`. No new backend routes — composes the
 * feeding-system-upgrade endpoints already built.
 */
export function FeedingTab({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.feeding");
  const ration = useResolvedRation(cattleId);
  const dmi = useDmi(cattleId);
  const [quickFeedOpen, setQuickFeedOpen] = useState(false);

  const isLoading = ration.isLoading || dmi.isLoading;
  const isError = ration.isError || dmi.isError;

  if (isLoading) return <CardSkeleton lines={4} />;
  if (isError) {
    return (
      <ErrorState
        onRetry={() => {
          ration.refetch();
          dmi.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Can I="feed.distribution-log">
          <Button variant="secondary" size="sm" onClick={() => setQuickFeedOpen(true)}>
            {t("feedNow")}
          </Button>
        </Can>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold text-foreground">{t("assignedRation")}</p>
        {!ration.data?.concentration ? (
          <EmptyState icon={Wheat} title={t("noRation")} description={t("noRationDescription")} />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{ration.data.concentration.name}</span>
              <span className="text-xs text-muted-foreground">
                {t("costPerDay", { value: ration.data.concentration.totals.total_cost_tk.toFixed(2) })}
              </span>
            </div>
            {ration.data.match_level ? (
              <Badge variant={MATCH_LEVEL_VARIANT[ration.data.match_level] ?? "secondary"}>
                {t(`matchLevel.${ration.data.match_level}`)}
              </Badge>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold text-foreground">{t("dmiTitle")}</p>
        {dmi.data ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border p-3">
              <span className="text-xs text-muted-foreground">{t("expectedDmi")}</span>
              <p className="text-lg font-semibold text-foreground">{t("kgValue", { value: dmi.data.expected_dmi_kg.toFixed(1) })}</p>
            </div>
            <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border p-3">
              <span className="text-xs text-muted-foreground">{t("actualDmi")}</span>
              <p className="text-lg font-semibold text-foreground">
                {dmi.data.actual_dmi_kg != null ? t("kgValue", { value: dmi.data.actual_dmi_kg.toFixed(1) }) : "—"}
              </p>
              {dmi.data.delta_pct != null ? (
                <span className={dmi.data.delta_pct < -10 || dmi.data.delta_pct > 10 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                  {t("deltaPct", { value: dmi.data.delta_pct.toFixed(1) })}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <EmptyState icon={Wheat} title={t("noDmi")} description={t("noDmiDescription")} />
        )}
      </Card>

      <QuickFeedDialog open={quickFeedOpen} onOpenChange={setQuickFeedOpen} initialCattleId={cattleId} />
    </div>
  );
}

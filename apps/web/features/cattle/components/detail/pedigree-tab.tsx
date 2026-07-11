"use client"; // live query

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { useCattlePedigree } from "../../hooks/use-cattle-detail-tabs";
import type { PedigreeNode, PedigreeOffspring, PedigreeSibling } from "../../detail-types";

function NodeCard({
  node,
  relationLabel,
  highlight = false,
}: {
  node: PedigreeNode | null;
  relationLabel: string;
  highlight?: boolean;
}) {
  const t = useTranslations("cattle.detail.pedigree");
  return (
    <Card className={`flex flex-col gap-1 p-3 ${highlight ? "border-primary ring-1 ring-primary" : ""}`}>
      <p className="text-xs text-muted-foreground">{relationLabel}</p>
      {node?.id ? (
        <>
          <p className="text-sm font-medium text-foreground">{node.name ?? node.tag}</p>
          <p className="text-xs text-muted-foreground">{node.tag}</p>
          <p className="text-xs text-muted-foreground">{t(`genderOptions.${node.gender}`)}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("unknown")}</p>
      )}
    </Card>
  );
}

/**
 * Pedigree tab (Figma B1-S10) — `GET /cattle/:id/pedigree`. Simplified vs the mock's dotted-canvas
 * `PedigreeChart` with orthogonal connector lines (an `@xyflow/react`-scale organism, out of scope
 * for one pass, PRD-spec flagged): renders the same data (dam/sire/self/siblings/offspring) as a
 * plain responsive card grid instead — parents row, self+siblings row, offspring row.
 */
export function PedigreeTab({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.pedigree");
  const query = useCattlePedigree(cattleId);

  if (query.isLoading) return <CardSkeleton lines={4} />;
  if (query.isError) {
    return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;
  }
  const data = query.data;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("parents")}</h3>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <NodeCard node={data.dam} relationLabel={t("mother")} />
          <NodeCard node={data.sire} relationLabel={t("father")} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("selfAndSiblings")}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <NodeCard node={data.self} relationLabel={t("self")} highlight />
          {data.siblings.map((s: PedigreeSibling) => (
            <NodeCard key={s.id} node={s} relationLabel={t(s.relation === "full_sibling" ? "fullSibling" : "halfSibling")} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("offspring")}</h3>
        {data.offspring.length === 0 ? (
          <EmptyState title={t("noOffspring")} className="py-8" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.offspring.map((o: PedigreeOffspring) => (
              <Card key={o.id} className="flex flex-col gap-1 p-3">
                <p className="text-sm font-medium text-foreground">{o.name ?? o.tag}</p>
                <p className="text-xs text-muted-foreground">{o.tag}</p>
                <Badge variant="secondary" className="w-fit">
                  {t(`genderOptions.${o.gender}`)}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

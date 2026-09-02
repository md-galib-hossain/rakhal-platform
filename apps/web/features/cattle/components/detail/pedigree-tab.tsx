"use client"; // live query

import { useTranslations } from "next-intl";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { useCattleDetailModal } from "../../context/cattle-detail-modal-context";
import { avatarTint } from "../../avatar-tint";
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
  const { openCattleDetail } = useCattleDetailModal();
  const label = node?.name ?? node?.tag ?? "?";
  const isClickable = Boolean(node?.id);

  return (
    <div
      onClick={() => {
        if (node?.id) openCattleDetail(node.id);
      }}
      className={cn(
        "flex w-[220px] shrink-0 flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm transition-all",
        highlight ? "border-primary ring-1 ring-primary" : "border-border",
        isClickable && "cursor-pointer hover:border-primary/50 hover:shadow-md",
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar className="size-9 rounded-lg">
          <AvatarFallback className={cn("rounded-lg text-xs", avatarTint(node?.id ?? relationLabel))}>
            {label.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className={cn("text-sm font-bold text-foreground", isClickable && "hover:underline")}>
            {node?.id ? label : t("unknown")}
          </p>
          <p className="text-xs text-muted-foreground">{node?.tag ?? "—"}</p>
        </div>
      </div>
      {node?.id ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Box className="size-3.5" aria-hidden />
            <span className="flex-1">{t("gender")}</span>
            <span className="font-bold text-foreground">{t(`genderOptions.${node.gender}`)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Box className="size-3.5" aria-hidden />
            <span className="flex-1">{t("relation")}</span>
            <span className="font-bold text-foreground">{relationLabel}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Pedigree tab (Figma "Single Cow Details" frame 1042:57994, "Pedigree Chart" node) — `GET
 * /cattle/:id/pedigree`. Renders dam/sire on a top row connected by an orthogonal line down to a
 * self+siblings row (matching the mock's parents→self connector), inside a dotted-grid canvas.
 * Kept as flex rows of plain divs rather than pulling in `@xyflow/react` (the mock's actual
 * canvas-engine chart is a scale-mismatched dependency for a single static 2-generation view).
 */
export function PedigreeTab({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.pedigree");
  const { openCattleDetail } = useCattleDetailModal();
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
        <div
          className="flex flex-col items-center gap-0 rounded-xl border border-border p-6"
          style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
        >
          <div className="flex w-full flex-wrap justify-center gap-6">
            <NodeCard node={data.dam} relationLabel={t("mother")} />
            <NodeCard node={data.sire} relationLabel={t("father")} />
          </div>
          <div className="flex h-8 w-px border-l border-border" />
          <div className="h-px w-[calc(220px+1.5rem)] border-t border-border" />
          <div className="flex h-8 w-px border-l border-border" />
          <div className="flex w-full flex-wrap justify-center gap-6">
            <NodeCard node={data.self} relationLabel={t("self")} highlight />
            {data.siblings.map((s: PedigreeSibling) => (
              <NodeCard key={s.id} node={s} relationLabel={t(s.relation === "full_sibling" ? "fullSibling" : "halfSibling")} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("offspring")}</h3>
        {data.offspring.length === 0 ? (
          <EmptyState title={t("noOffspring")} className="py-8" />
        ) : (
          <div className="flex flex-wrap gap-3">
            {data.offspring.map((o: PedigreeOffspring) => (
              <button
                type="button"
                key={o.id}
                onClick={() => openCattleDetail(o.id)}
                className="flex w-[220px] flex-col gap-1 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
              >
                <p className="text-sm font-bold text-foreground hover:underline">{o.name ?? o.tag}</p>
                <p className="text-xs text-muted-foreground">{o.tag}</p>
                <Badge variant="secondary" className="w-fit">
                  {t(`genderOptions.${o.gender}`)}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

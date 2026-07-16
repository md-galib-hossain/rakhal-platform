"use client"; // list state + create/detail dialog open state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Wheat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Can } from "@/lib/auth/permissions";
import { useConcentrations, useFeedGroups } from "../hooks/use-feed";
import { ConcentrationCard } from "./concentration-card";
import { CreateFeedDialog } from "./create-feed-dialog";
import { ConcentrationDetailSheet } from "./concentration-detail-sheet";
import type { FeedConcentrationSummary, FeedGroup } from "../types";

function ConcentrationSection({
  title,
  createLabel,
  items,
  isLoading,
  isError,
  onRetry,
  emptyDescription,
  feedGroupById,
  onSeeDetails,
  onCreate,
}: {
  title: string;
  createLabel: string;
  items: FeedConcentrationSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyDescription: string;
  feedGroupById: Map<string, FeedGroup>;
  onSeeDetails: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xl font-medium text-foreground">{title}</p>
        <Can I="feed.create">
          <Button variant="primary" size="sm" className="gap-2" onClick={onCreate}>
            <Plus className="size-[18px]" aria-hidden />
            {createLabel}
          </Button>
        </Can>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      ) : isError ? (
        <ErrorState onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState icon={Wheat} title={emptyDescription} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {items.map((item) => (
            <ConcentrationCard
              key={item.id}
              concentration={item}
              feedGroup={item.feed_group_id ? feedGroupById.get(item.feed_group_id) : undefined}
              onSeeDetails={() => onSeeDetails(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Feed Formulator page body — Figma "Feed Formulator" list frame (`1048:33190`, file
 * `SCfMPdxP6vgW1uTxfqCtz7`): "Concentration Template" + "Feed Mixture" card sections. Both read from
 * the same `GET /feed/concentrations` list (there's only one `FeedConcentration` resource, see
 * `types.ts`'s doc comment) — split client-side by whether `balance_score` is present. Both
 * "Create New Template"/"Create New Feed" buttons open the identical wizard (same precedent as
 * Finance's one Record wizard reused across 4 entry points).
 */
export function FeedView() {
  const t = useTranslations("feed");
  const concentrations = useConcentrations();
  const feedGroups = useFeedGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const feedGroupById = useMemo(() => new Map((feedGroups.data ?? []).map((g) => [g.id, g])), [feedGroups.data]);

  const templates = useMemo(() => (concentrations.data ?? []).filter((c) => c.balance_score == null), [concentrations.data]);
  const mixtures = useMemo(() => (concentrations.data ?? []).filter((c) => c.balance_score != null), [concentrations.data]);

  return (
    <div className="flex flex-col gap-4">
      <ConcentrationSection
        title={t("concentrationTemplate")}
        createLabel={t("createNewTemplate")}
        items={templates}
        isLoading={concentrations.isLoading}
        isError={concentrations.isError}
        onRetry={() => concentrations.refetch()}
        emptyDescription={t("noTemplates")}
        feedGroupById={feedGroupById}
        onSeeDetails={setDetailId}
        onCreate={() => setCreateOpen(true)}
      />
      <ConcentrationSection
        title={t("feedMixture")}
        createLabel={t("createNewFeed")}
        items={mixtures}
        isLoading={concentrations.isLoading}
        isError={concentrations.isError}
        onRetry={() => concentrations.refetch()}
        emptyDescription={t("noFeeds")}
        feedGroupById={feedGroupById}
        onSeeDetails={setDetailId}
        onCreate={() => setCreateOpen(true)}
      />

      <CreateFeedDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConcentrationDetailSheet concentrationId={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
    </div>
  );
}

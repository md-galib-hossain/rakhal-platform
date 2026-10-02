"use client"; // live query

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useRounds } from "../hooks/use-health";
import { roundUrgency } from "../round-model";
import type { HealthPlanKind, ProtocolRound } from "../types";
import { RoundCard } from "./round-card";

/**
 * The Protocols page's **Running** view (RFE-146, EPIC_PROTOCOL_ROUNDS D1/D6): one card per round — an application of a
 * protocol on one day — instead of one card per protocol. Running rounds come most urgent first (late, due today, soonest
 * next step); with `finished` it lists the rounds with nothing left to do, newest first (the server's order). Kind and
 * search come from the page's own toolbar, so both views filter the same way.
 */
export function RoundsView({
  kind,
  search,
  finished,
  onOpen,
  onShowLibrary,
}: {
  kind: HealthPlanKind | "ALL";
  search: string;
  finished: boolean;
  onOpen: (round: ProtocolRound) => void;
  onShowLibrary: () => void;
}) {
  const t = useTranslations("health.healthPlan.rounds");
  const query = useRounds({ status: finished ? "FINISHED" : "RUNNING", kind: kind === "ALL" ? undefined : kind, search: search || undefined });

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[200px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (query.isError) return <ErrorState description={t("error")} onRetry={() => void query.refetch()} />;

  const items = query.data?.items ?? [];
  const rounds = finished ? items : [...items].sort(roundUrgency);
  const filtered = kind !== "ALL" || search !== "";

  if (rounds.length === 0) {
    if (filtered) return <EmptyState title={t("emptyFilteredTitle")} />;
    return finished ? (
      <EmptyState title={t("emptyFinishedTitle")} description={t("emptyFinishedDescription")} />
    ) : (
      <EmptyState
        title={t("emptyRunningTitle")}
        description={t("emptyRunningDescription")}
        action={
          <Button type="button" size="sm" onClick={onShowLibrary}>
            {t("goLibrary")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid grid-cols-1 gap-4 transition-opacity lg:grid-cols-2", query.isFetching && "opacity-70")}>
        {rounds.map((round) => (
          <RoundCard key={round.roundKey} round={round} onOpen={onOpen} />
        ))}
      </div>
      {query.data?.meta.hasNextPage ? <p className="text-xs text-warning">{t("truncated")}</p> : null}
    </div>
  );
}

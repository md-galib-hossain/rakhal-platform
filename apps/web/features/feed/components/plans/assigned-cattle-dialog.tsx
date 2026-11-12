"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe, Plus, Search, SearchX, UserMinus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnimalLink } from "@/components/shared/animal-link";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { Can } from "@/lib/auth/permissions";
import { avatarTint } from "@/features/cattle/avatar-tint";
import { cattleApi } from "@/features/cattle/api";
import { useAnimalGroups } from "@/features/cattle/hooks/use-cattle";
import type { CattleDetail } from "@/features/cattle/types";
import { useFeedPlanAssignments, useRemoveFeedAssignment } from "../../hooks/use-feed-plans";
import type { FeedPlan, FeedPlanAssignment, FeedPlanTarget } from "../../plans-types";

export interface AssignedCattleDialogProps {
  plan: FeedPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyMore: () => void;
}

type FilterType = "ALL" | FeedPlanTarget;

interface RemoveTarget {
  assignment: FeedPlanAssignment;
  label: string;
  tag?: string;
  isGroupOrHerd: boolean;
}

export function AssignedCattleDialog({
  plan,
  open,
  onOpenChange,
  onApplyMore,
}: AssignedCattleDialogProps) {
  const t = useTranslations("feed.plans.assignedModal");
  const tCard = useTranslations("feed.plans.card");
  const assignmentsQuery = useFeedPlanAssignments(plan?.id);
  const groupsQuery = useAnimalGroups();
  const remove = useRemoveFeedAssignment();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [removing, setRemoving] = useState<RemoveTarget | null>(null);

  const rawAssignments = useMemo(
    () => assignmentsQuery.data?.items ?? [],
    [assignmentsQuery.data?.items],
  );
  const groups = useMemo(
    () => groupsQuery.data?.items ?? [],
    [groupsQuery.data?.items],
  );

  const groupMap = useMemo(() => {
    const map = new Map<string, { name: string; memberCount: number }>();
    groups.forEach((g) => {
      map.set(g.id, { name: g.name, memberCount: g.memberCount });
    });
    return map;
  }, [groups]);

  // Extract direct cattle IDs to query details
  const directCattleIds = useMemo(() => {
    return Array.from(
      new Set(
        rawAssignments
          .filter((a) => a.target_type === "INDIVIDUAL" && a.cattle_id)
          .map((a) => a.cattle_id as string),
      ),
    );
  }, [rawAssignments]);

  // Parallel fetch cattle details using useQueries
  const cattleQueries = useQueries({
    queries: directCattleIds.map((id) => ({
      queryKey: qk.cattle.detail(id),
      queryFn: () => cattleApi.findOne(id),
      staleTime: 60_000,
      enabled: open && Boolean(id),
    })),
  });

  const cattleMap = useMemo(() => {
    const map = new Map<string, CattleDetail>();
    directCattleIds.forEach((id, idx) => {
      const q = cattleQueries[idx];
      if (q?.data) {
        map.set(id, q.data);
      }
    });
    return map;
  }, [directCattleIds, cattleQueries]);

  const directAssignments = useMemo(
    () => rawAssignments.filter((a) => a.target_type === "INDIVIDUAL"),
    [rawAssignments],
  );
  const groupAssignments = useMemo(
    () => rawAssignments.filter((a) => a.target_type === "GROUP"),
    [rawAssignments],
  );
  const herdAssignments = useMemo(
    () => rawAssignments.filter((a) => a.target_type === "HERD"),
    [rawAssignments],
  );

  // Group member sum
  const groupMembersTotal = useMemo(() => {
    return groupAssignments.reduce((sum, a) => {
      const info = a.animal_group_id ? groupMap.get(a.animal_group_id) : undefined;
      return sum + (info?.memberCount ?? 0);
    }, 0);
  }, [groupAssignments, groupMap]);

  const totalAssignedCattle = directAssignments.length + groupMembersTotal;
  const isHerdOnly = herdAssignments.length > 0 && totalAssignedCattle === 0;
  const planKgPerHead = plan?.total_kg_per_day ?? 0;
  const totalDailyDemand = (planKgPerHead * (totalAssignedCattle || (herdAssignments.length ? 1 : 0))).toFixed(1);

  // Filter and search
  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rawAssignments.filter((a) => {
      // Type filter
      if (filter !== "ALL" && a.target_type !== filter) {
        return false;
      }

      // Search query filter
      if (!q) return true;

      if (a.target_type === "INDIVIDUAL" && a.cattle_id) {
        const cow = cattleMap.get(a.cattle_id);
        const name = cow?.name?.toLowerCase() ?? "";
        const tag = cow?.tagNumber?.toLowerCase() ?? "";
        return name.includes(q) || tag.includes(q);
      }

      if (a.target_type === "GROUP" && a.animal_group_id) {
        const gName = groupMap.get(a.animal_group_id)?.name?.toLowerCase() ?? "";
        return gName.includes(q);
      }

      if (a.target_type === "HERD") {
        const herdKeywords = ["herd", "whole", "default", "পাল", "সব"];
        return herdKeywords.some((kw) => kw.includes(q) || q.includes(kw));
      }

      return true;
    });
  }, [rawAssignments, filter, search, cattleMap, groupMap]);

  async function handleConfirmRemove() {
    if (!removing) return;
    try {
      await remove.mutateAsync(removing.assignment.id);
      toast.success(
        t("removeSuccessToast", {
          cowName: removing.label,
          planName: plan?.name ?? "",
        }),
      );
      setRemoving(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCard("genericError"));
    }
  }

  const isDetailsLoading = assignmentsQuery.isLoading || (directCattleIds.length > 0 && cattleQueries.some((q) => q.isLoading));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-full max-w-4xl flex-col p-0">
          {/* Header */}
          <DialogHeader className="border-b border-border p-5 pb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pr-6">
              <DialogTitle className="text-xl font-semibold text-foreground">
                {t("title", { name: plan?.name ?? "" })}
              </DialogTitle>
              <span className="text-xs font-semibold tabular-nums text-primary">
                {planKgPerHead.toFixed(1)} kg / head / day
              </span>
            </div>
            <DialogDescription className="mt-1 text-xs text-muted-foreground">
              {t("subtitle", {
                kg: planKgPerHead.toFixed(1),
                totalDemand: totalDailyDemand,
              })}
            </DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">{t("kpis.totalCattle")}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                  {herdAssignments.length > 0 && totalAssignedCattle === 0
                    ? t("kpis.herdCount")
                    : totalAssignedCattle}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {directAssignments.length} direct · {groupAssignments.length} groups
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">{t("kpis.totalDemand")}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                  {totalDailyDemand} <span className="text-xs font-normal text-muted-foreground">{t("kpis.demandUnit")}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isHerdOnly
                    ? t("kpis.herdDemandPerHead", { kg: planKgPerHead.toFixed(1) })
                    : `${planKgPerHead.toFixed(1)} kg × ${totalAssignedCattle} cattle`}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">{t("kpis.assignmentTypes")}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {directAssignments.length > 0 && t("kpis.directCount", { count: directAssignments.length })}
                  {directAssignments.length > 0 && (groupAssignments.length > 0 || herdAssignments.length > 0) && " · "}
                  {groupAssignments.length > 0 && t("kpis.groupCount", { count: groupAssignments.length })}
                  {groupAssignments.length > 0 && herdAssignments.length > 0 && " · "}
                  {herdAssignments.length > 0 && t("kpis.herdCount")}
                  {rawAssignments.length === 0 && "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {rawAssignments.length} total assignment {rawAssignments.length === 1 ? "rule" : "rules"}
                </p>
              </div>
            </div>

            {/* Filter and Search Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="pl-9 pr-8"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant={filter === "ALL" ? "primary" : "outline"}
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => setFilter("ALL")}
                >
                  {t("filters.all", { count: rawAssignments.length })}
                </Button>
                <Button
                  type="button"
                  variant={filter === "INDIVIDUAL" ? "primary" : "outline"}
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => setFilter("INDIVIDUAL")}
                >
                  {t("filters.direct", { count: directAssignments.length })}
                </Button>
                <Button
                  type="button"
                  variant={filter === "GROUP" ? "primary" : "outline"}
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => setFilter("GROUP")}
                >
                  {t("filters.group", { count: groupAssignments.length })}
                </Button>
                {herdAssignments.length > 0 && (
                  <Button
                    type="button"
                    variant={filter === "HERD" ? "primary" : "outline"}
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => setFilter("HERD")}
                  >
                    {t("filters.herd", { count: herdAssignments.length })}
                  </Button>
                )}

                <Can I="feed.update">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      onApplyMore();
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {t("applyMore")}
                  </Button>
                </Can>
              </div>
            </div>

            {/* Cattle Rows List */}
            {isDetailsLoading ? (
              <div className="flex flex-col gap-2.5 py-4">
                <CardSkeleton lines={2} />
                <CardSkeleton lines={2} />
                <CardSkeleton lines={2} />
              </div>
            ) : filteredAssignments.length === 0 && search.trim() ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                <SearchX className="size-10 text-muted-foreground" aria-hidden />
                <h4 className="mt-3 text-sm font-semibold text-foreground">
                  {t("emptyFilterTitle", { query: search.trim() })}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">{t("emptyFilterHint")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 text-xs"
                  onClick={() => setSearch("")}
                >
                  Reset search
                </Button>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                <Users className="size-10 text-muted-foreground" aria-hidden />
                <h4 className="mt-3 text-sm font-semibold text-foreground">{t("emptyNoCowsTitle")}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{t("emptyNoCowsHint")}</p>
                <Can I="feed.update">
                  <Button
                    type="button"
                    size="sm"
                    className="mt-4 gap-1.5 text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      onApplyMore();
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    {t("applyMore")}
                  </Button>
                </Can>
              </div>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="Assigned animals">
                {filteredAssignments.map((a) => {
                  if (a.target_type === "INDIVIDUAL" && a.cattle_id) {
                    const cow = cattleMap.get(a.cattle_id);
                    const cowName = cow?.name || cow?.tagNumber || "Animal";
                    const tagNumber = cow?.tagNumber ?? "";
                    const breedName = cow?.breed?.name;
                    const shedName = cow?.shed?.name;
                    const photoUrl = cow?.profile_photo?.thumb_url ?? cow?.image;
                    const tint = avatarTint(a.cattle_id);

                    return (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs transition-colors hover:border-primary/40"
                      >
                        {/* Left: Cattle Identity */}
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className={cn("size-10 shrink-0 font-bold", tint)}>
                            {photoUrl && <AvatarImage src={photoUrl} alt={cowName} />}
                            <AvatarFallback className={cn("text-xs font-semibold uppercase", tint)}>
                              {cowName.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <AnimalLink
                                id={a.cattle_id}
                                animalName={cow?.name}
                                tagNumber={cow?.tagNumber}
                                className="truncate text-sm font-semibold text-foreground hover:text-primary"
                              />
                              {tagNumber && (
                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                                  {tagNumber}
                                </span>
                              )}
                            </div>
                            {(breedName || shedName) && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {[breedName, shedName].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Center: Badge */}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-info/40 bg-info-tint text-xs text-info">
                            Direct Assignment
                          </Badge>
                        </div>

                        {/* Right: Intake & Remove */}
                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-xs font-semibold text-foreground">
                            {planKgPerHead.toFixed(1)} kg/day
                          </span>
                          <Can I="feed.update">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs text-muted-foreground hover:bg-destructive-tint hover:text-destructive"
                              onClick={() =>
                                setRemoving({
                                  assignment: a,
                                  label: cowName,
                                  tag: tagNumber,
                                  isGroupOrHerd: false,
                                })
                              }
                            >
                              <UserMinus className="size-3.5" aria-hidden />
                              <span>{t("removeAction")}</span>
                            </Button>
                          </Can>
                        </div>
                      </li>
                    );
                  }

                  if (a.target_type === "GROUP" && a.animal_group_id) {
                    const gInfo = groupMap.get(a.animal_group_id);
                    const groupName = gInfo?.name ?? "Group";
                    const memberCount = gInfo?.memberCount ?? 0;
                    const tint = avatarTint(a.animal_group_id);

                    return (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs transition-colors hover:border-primary/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full font-bold", tint)}>
                            <Users className="size-5" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              Group: {groupName}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {memberCount} {memberCount === 1 ? "animal" : "animals"} in group
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-accent-purple/40 bg-accent-purple-tint text-xs text-accent-purple"
                          >
                            Group Assignment
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-xs font-semibold text-foreground">
                            {planKgPerHead.toFixed(1)} kg/day
                          </span>
                          <Can I="feed.update">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs text-muted-foreground hover:bg-destructive-tint hover:text-destructive"
                              onClick={() =>
                                setRemoving({
                                  assignment: a,
                                  label: groupName,
                                  isGroupOrHerd: true,
                                })
                              }
                            >
                              <UserMinus className="size-3.5" aria-hidden />
                              <span>{t("removeAction")}</span>
                            </Button>
                          </Can>
                        </div>
                      </li>
                    );
                  }

                  if (a.target_type === "HERD") {
                    return (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs transition-colors hover:border-primary/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-tint font-bold text-success">
                            <Globe className="size-5" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">Whole Herd Default</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Default ration for all active cattle without an individual or group program
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-success/40 bg-success-tint text-xs text-success">
                            Whole Herd Default
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-xs font-semibold text-foreground">
                            {planKgPerHead.toFixed(1)} kg/day
                          </span>
                          <Can I="feed.update">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs text-muted-foreground hover:bg-destructive-tint hover:text-destructive"
                              onClick={() =>
                                setRemoving({
                                  assignment: a,
                                  label: "Whole Herd",
                                  isGroupOrHerd: true,
                                })
                              }
                            >
                              <UserMinus className="size-3.5" aria-hidden />
                              <span>{t("removeAction")}</span>
                            </Button>
                          </Can>
                        </div>
                      </li>
                    );
                  }

                  return null;
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="flex items-center justify-between border-t border-border p-4 sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {filteredAssignments.length} assigned {filteredAssignments.length === 1 ? "target" : "targets"}
            </span>
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Safe Context-Aware Confirmation Dialog */}
      <ConfirmDialog
        open={removing != null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeConfirmTitle", { cowName: removing?.label ?? "" })}
        description={t("removeConfirmDesc", {
          target: removing?.tag?.trim()
            ? `${removing.label} (${removing.tag.trim()})`
            : (removing?.label ?? ""),
          cowName: removing?.tag?.trim()
            ? `${removing.label} (${removing.tag.trim()})`
            : (removing?.label ?? ""),
          tagNumber: removing?.tag?.trim() ?? "",
        })}
        confirmLabel={t("removeAction")}
        onConfirm={handleConfirmRemove}
      />
    </>
  );
}

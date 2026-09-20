"use client"; // dialogs + selection state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Loader2, Pencil, Plus, Trash2, Users, Wheat, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/shared/form-sheet";
import { CattleMultiPicker, type CattleOption } from "@/components/shared/cattle-picker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { FloatingInput } from "@/components/ui/floating-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useFeedGroups } from "@/features/settings/hooks/use-workspace";
import {
  useCreateFeedGroup,
  useDeleteFeedGroup,
  useUpdateFeedGroup,
} from "@/features/settings/hooks/use-workspace-mutations";
import { feedGroupFormSchema, type FeedGroupFormInput } from "@/features/settings/schemas";
import type { FeedGroup } from "@/features/settings/types";
import { useConcentrations, useFeedStock } from "@/features/feed/hooks/use-feed";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import type { FeedGridSourceType, FeedGroupCattle } from "@/features/feed/types";
import {
  useAssignCattleToGroup,
  useGroupCattle,
  useRemoveCattleFromGroup,
  useSetGroupDefaultConcentration,
  useSetGroupDefaultFeedSource,
} from "../hooks/use-feed-groups";

/**
 * Feed group management, on the page where groups are actually used (RFE-102).
 *
 * Moved out of Settings › Farm Workspace: a farmer sets groups up while planning feeding, not
 * while editing farm metadata. `/feeding` already listed groups read-only, so this replaces
 * that block rather than adding a second list.
 *
 * The move also surfaces three things the old Settings dialog hid even though the backend has
 * always supported them: the refusal target, the group's default ration, and cattle assignment
 * (`/feed/groups/:id/cattle` + `assign-cattle` — routes that shipped with no UI at all).
 *
 * The routes stay at `/settings/feed-groups`; only the UI moved. Relocating the controller
 * would break `features/feed/api.ts`, two backend e2e specs and the API doc for no user gain.
 */
export function FeedGroupsSection({
  onFeedToday,
}: {
  onFeedToday: (concentrationId: string) => void;
}) {
  const t = useTranslations("feeding.groups");
  const groups = useFeedGroups();
  const concentrations = useConcentrations();

  const [formTarget, setFormTarget] = useState<FeedGroup | "new" | null>(null);
  const [assignTarget, setAssignTarget] = useState<FeedGroup | null>(null);

  /** One active GROUP-targeted TMR per group, so "Feed Today" can route without a picker. */
  const tmrByGroup = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of concentrations.data ?? []) {
      if (c.kind === "FEED_MIXTURE" && c.target_type === "GROUP" && c.feed_group_id) {
        map.set(c.feed_group_id, c.id);
      }
    }
    return map;
  }, [concentrations.data]);

  const herdTmr = (concentrations.data ?? []).find(
    (c) => c.kind === "FEED_MIXTURE" && c.target_type === "HERD",
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <p className="text-lg font-medium text-foreground">{t("title")}</p>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Can I="settings.update">
          <Button className="gap-1.5" onClick={() => setFormTarget("new")}>
            <Plus className="size-4" aria-hidden />
            {t("create")}
          </Button>
        </Can>
      </div>

      {groups.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : groups.isError ? (
        <ErrorState onRetry={() => void groups.refetch()} />
      ) : (groups.data ?? []).length === 0 ? (
        <EmptyState icon={Wheat} title={t("empty")} description={t("emptyDescription")} />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {(groups.data ?? []).map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              tmrId={group.default_concentration_id ?? tmrByGroup.get(group.id) ?? herdTmr?.id}
              onEdit={() => setFormTarget(group)}
              onAssign={() => setAssignTarget(group)}
              onFeedToday={onFeedToday}
            />
          ))}
        </div>
      )}

      {formTarget ? (
        <FeedGroupFormDialog
          group={formTarget === "new" ? null : formTarget}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      {assignTarget ? (
        <AssignCattleDialog group={assignTarget} onClose={() => setAssignTarget(null)} />
      ) : null}
    </div>
  );
}

function GroupRow({
  group,
  tmrId,
  onEdit,
  onAssign,
  onFeedToday,
}: {
  group: FeedGroup;
  tmrId: string | undefined;
  onEdit: () => void;
  onAssign: () => void;
  onFeedToday: (concentrationId: string) => void;
}) {
  const t = useTranslations("feeding.groups");
  const deleteGroup = useDeleteFeedGroup();
  const setDefault = useSetGroupDefaultConcentration();
  const setDefaultSource = useSetGroupDefaultFeedSource();
  const concentrations = useConcentrations();
  const feedItems = useFeedItemPagedList({});
  const feedStock = useFeedStock();

  const mixtures = (concentrations.data ?? []).filter((c) => c.kind === "FEED_MIXTURE");

  const feedItemOptions = useMemo(
    () => feedItems.items.map((item) => ({ id: item.id, label: `${item.name} (${item.currentStock} ${item.unit.symbol})` })),
    [feedItems.items],
  );
  const stockOptions = useMemo(
    () =>
      (feedStock.data ?? []).map((s) => ({
        id: s.id,
        label: `${concentrations.data?.find((c) => c.id === s.source_concentration_id)?.name ?? t("unknownStock")} (${s.current_stock_kg} kg)`,
      })),
    [feedStock.data, concentrations.data, t],
  );

  const defaultSourceValue =
    group.default_feed_source_type === "FEED_ITEM"
      ? `FEED_ITEM:${group.default_feed_item_id}`
      : group.default_feed_source_type === "FEED_STOCK"
        ? `FEED_STOCK:${group.default_feed_stock_id}`
        : "none";

  async function handleDefaultSourceChange(value: string) {
    try {
      if (value === "none") {
        await setDefaultSource.mutateAsync({ groupId: group.id, source: null });
      } else {
        const sourceType = value.slice(0, value.indexOf(":")) as FeedGridSourceType;
        const itemId = value.slice(value.indexOf(":") + 1);
        await setDefaultSource.mutateAsync({
          groupId: group.id,
          source: {
            sourceType,
            feedItemId: sourceType === "FEED_ITEM" ? itemId : undefined,
            feedStockId: sourceType === "FEED_STOCK" ? itemId : undefined,
          },
        });
      }
      toast.success(t("defaultSourceSaved"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("defaultSourceFailed"));
    }
  }

  async function handleDelete() {
    try {
      await deleteGroup.mutateAsync(group.id);
      toast.success(t("deleted", { name: group.name }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("deleteFailed"));
    }
  }

  async function handleDefaultChange(value: string) {
    try {
      await setDefault.mutateAsync({
        groupId: group.id,
        concentrationId: value === "none" ? null : value,
      });
      toast.success(t("defaultSaved"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("defaultFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{group.name}</span>
            <Badge variant="outline">{t("cowCount", { count: group.assigned_count })}</Badge>
            {group.refusal_target_pct != null ? (
              <Badge variant="secondary">
                {t("refusalBadge", { pct: group.refusal_target_pct })}
              </Badge>
            ) : null}
          </div>
          {group.description ? (
            <span className="text-xs text-muted-foreground">{group.description}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Can I="feed.distribution-log">
            <Button
              variant="secondary"
              size="sm"
              disabled={!tmrId}
              onClick={() => tmrId && onFeedToday(tmrId)}
            >
              {t("feedToday")}
            </Button>
          </Can>
          <Can I="feed.update">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={onAssign}>
              <Users className="size-4" aria-hidden />
              {t("assignCattle")}
            </Button>
          </Can>
          <Can I="settings.update">
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label={t("edit")}>
              <Pencil className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={deleteGroup.isPending}
              onClick={() => void handleDelete()}
              aria-label={t("delete")}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </Can>
        </div>
      </div>

      <Can I="feed.update">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("defaultRation")}</span>
          <Select
            value={group.default_concentration_id ?? "none"}
            onValueChange={(v) => void handleDefaultChange(v)}
          >
            <SelectTrigger className="h-8 w-64 text-xs">
              <SelectValue placeholder={t("noDefaultRation")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("noDefaultRation")}</SelectItem>
              {mixtures.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("defaultSource")}</span>
          <Select value={defaultSourceValue} onValueChange={(v) => void handleDefaultSourceChange(v)}>
            <SelectTrigger className="h-8 w-64 text-xs">
              <SelectValue placeholder={t("noDefaultSource")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("noDefaultSource")}</SelectItem>
              {feedItemOptions.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>{t("sourceGroups.feedItems")}</SelectLabel>
                  {feedItemOptions.map((opt) => (
                    <SelectItem key={opt.id} value={`FEED_ITEM:${opt.id}`}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {stockOptions.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>{t("sourceGroups.preparedBatches")}</SelectLabel>
                  {stockOptions.map((opt) => (
                    <SelectItem key={opt.id} value={`FEED_STOCK:${opt.id}`}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      </Can>
    </div>
  );
}

function FeedGroupFormDialog({
  group,
  onClose,
}: {
  group: FeedGroup | null;
  onClose: () => void;
}) {
  const t = useTranslations("feeding.groups");
  const createGroup = useCreateFeedGroup();
  const updateGroup = useUpdateFeedGroup();

  const form = useForm<FeedGroupFormInput>({
    resolver: zodResolver(feedGroupFormSchema),
    defaultValues: {
      name: group?.name ?? "",
      description: group?.description ?? "",
      refusalTargetPct:
        group?.refusal_target_pct != null ? String(group.refusal_target_pct) : "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (group) await updateGroup.mutateAsync({ id: group.id, input: values });
      else await createGroup.mutateAsync(values);
      toast.success(group ? t("updated") : t("created"));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("saveFailed"));
    }
  });

  const pending = createGroup.isPending || updateGroup.isPending;

  return (
    <FormSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={group ? t("editTitle") : t("createTitle")}
      description={t("formDescription")}
      onSubmit={onSubmit}
      submitLabel={pending ? t("saving") : t("save")}
      cancelLabel={t("cancel")}
      pending={pending}
    >
      <FloatingInput
        label={t("nameLabel")}
        {...form.register("name")}
        error={form.formState.errors.name?.message}
      />
      <FloatingInput
        label={t("descriptionLabel")}
        {...form.register("description")}
        error={form.formState.errors.description?.message}
      />
      <div className="flex flex-col gap-1">
        <FloatingInput
          label={t("refusalLabel")}
          type="number"
          step="0.1"
          {...form.register("refusalTargetPct")}
          error={form.formState.errors.refusalTargetPct?.message}
        />
        <p className="text-xs text-muted-foreground">{t("refusalHint")}</p>
      </div>
    </FormSheet>
  );
}

/** UI for `GET /feed/groups/:id/cattle` + `POST .../assign-cattle`, both live since Phase 4 with no
 * frontend consumer until RFE-102. Originally rendered the *current* members list as checkboxes to
 * toggle — which left a brand-new (0-cow) group with nothing to check and no way to add anyone
 * (user report 2026-09-09, "i cant find any option ... no option to add animals"). `assign-cattle`
 * only ever moves cattle *into* this group (`Cattle.feedGroupId = groupId` — see
 * `feed-group-assign.service.ts`), so this is deliberately an "add" picker (`CattleMultiPicker`,
 * farm-wide search, existing members excluded) above the current-members list, plus a per-row
 * remove button on that list (follow-up user report, "i cant remove already added animal") backed
 * by `useRemoveCattleFromGroup` — since there's no dedicated unassign route, that hook reuses
 * Cattle's own bulk `change_feed_group` endpoint against a single cow to clear its `feedGroupId`. */
function AssignCattleDialog({ group, onClose }: { group: FeedGroup; onClose: () => void }) {
  const t = useTranslations("feeding.groups");
  const members = useGroupCattle(group.id);
  const assign = useAssignCattleToGroup();
  const remove = useRemoveCattleFromGroup();
  const [newCattle, setNewCattle] = useState<CattleOption[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const rows = useMemo(() => members.data ?? [], [members.data]);
  const existingIds = useMemo(() => rows.map((c) => c.id), [rows]);

  async function handleAssign() {
    try {
      const result = await assign.mutateAsync({
        groupId: group.id,
        cattleIds: newCattle.map((c) => c.id),
      });
      toast.success(t("assigned", { count: result.assigned }));
      setNewCattle([]);
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("assignFailed"));
    }
  }

  async function handleRemove(cow: FeedGroupCattle) {
    setRemovingId(cow.id);
    try {
      await remove.mutateAsync({ groupId: group.id, cattleId: cow.id });
      toast.success(t("removed", { name: cow.name ?? cow.tagNumber }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("removeFailed"));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showClose={false}
        className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-lg sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
      >
        <div className="flex items-center justify-between pb-5">
          <SheetTitle className="text-xl font-bold text-foreground">
            {t("assignTitle", { name: group.name })}
          </SheetTitle>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
          >
            <ArrowRightToLine className="size-5" aria-hidden />
          </button>
        </div>
        <div className="border-t border-dashed border-border" />

        <div className="flex flex-1 flex-col overflow-y-auto px-1 py-4 gap-4">
          <SheetDescription>{t("assignDescription")}</SheetDescription>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">{t("addCattleLabel")}</p>
            <CattleMultiPicker
              value={newCattle}
              onValueChange={setNewCattle}
              placeholder={t("searchCattlePlaceholder")}
              excludeIds={existingIds}
            />
            {newCattle.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {newCattle.map((c) => (
                  <span
                    key={c.id}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-bold text-foreground"
                  >
                    {c.tagNumber}
                    {c.name ? ` — ${c.name}` : ""}
                    <button
                      type="button"
                      onClick={() => setNewCattle((prev) => prev.filter((x) => x.id !== c.id))}
                      aria-label={t("removeCow", { cow: c.tagNumber })}
                      className="text-muted-foreground transition-opacity hover:opacity-70"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="border-t border-dashed border-border" />

          {members.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : members.isError ? (
            <ErrorState onRetry={() => void members.refetch()} />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t("currentMembers", { count: rows.length })}
              </p>
              <div className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {rows.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">{t("noMembers")}</p>
                ) : (
                  rows.map((cow) => (
                    <div key={cow.id} className="flex items-center justify-between gap-2 p-3 text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{cow.name ?? cow.tagNumber}</span>
                        <span className="text-xs text-muted-foreground">{cow.tagNumber}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemove(cow)}
                        disabled={removingId === cow.id}
                        aria-label={t("removeFromGroup", { name: cow.name ?? cow.tagNumber })}
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        {removingId === cow.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <X className="size-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 px-1 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className="h-12 flex-1"
            onClick={() => void handleAssign()}
            disabled={assign.isPending || newCattle.length === 0}
          >
            {assign.isPending ? t("assigning") : t("assignSelected", { count: newCattle.length })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

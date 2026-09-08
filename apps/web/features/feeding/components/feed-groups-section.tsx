"use client"; // dialogs + selection state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Users, Wheat } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FloatingInput } from "@/components/ui/floating-input";
import {
  Select,
  SelectContent,
  SelectItem,
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
import { useConcentrations } from "@/features/feed/hooks/use-feed";
import {
  useAssignCattleToGroup,
  useGroupCattle,
  useSetGroupDefaultConcentration,
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
          <Button size="sm" className="gap-1.5" onClick={() => setFormTarget("new")}>
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
  const concentrations = useConcentrations();

  const mixtures = (concentrations.data ?? []).filter((c) => c.kind === "FEED_MIXTURE");

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{group ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
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

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** First UI for `GET /feed/groups/:id/cattle` + `POST .../assign-cattle`, both live since Phase 4. */
function AssignCattleDialog({ group, onClose }: { group: FeedGroup; onClose: () => void }) {
  const t = useTranslations("feeding.groups");
  const members = useGroupCattle(group.id);
  const assign = useAssignCattleToGroup();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  async function handleAssign() {
    try {
      const result = await assign.mutateAsync({
        groupId: group.id,
        cattleIds: [...selected],
      });
      toast.success(t("assigned", { count: result.assigned }));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("assignFailed"));
    }
  }

  const rows = members.data ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("assignTitle", { name: group.name })}</DialogTitle>
          <DialogDescription>{t("assignDescription")}</DialogDescription>
        </DialogHeader>

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
                  <label
                    key={cow.id}
                    className="flex cursor-pointer items-center gap-2 p-3 text-sm text-foreground"
                  >
                    <Checkbox
                      checked={selected.has(cow.id)}
                      onCheckedChange={(v) => toggle(cow.id, v === true)}
                    />
                    <span>{cow.name ?? cow.tagNumber}</span>
                    <span className="text-xs text-muted-foreground">{cow.tagNumber}</span>
                  </label>
                ))
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void handleAssign()}
            disabled={assign.isPending || selected.size === 0}
          >
            {assign.isPending ? t("assigning") : t("assignSelected", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

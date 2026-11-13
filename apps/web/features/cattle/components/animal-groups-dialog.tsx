"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import {
  ArrowLeft,
  Check,
  Edit2,
  ExternalLink,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { apiFetchPage } from "@/lib/api/client";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@rakhal/ui/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rakhal/ui/ui/dialog";
import { Button } from "@rakhal/ui/ui/button";
import { Input } from "@rakhal/ui/ui/input";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { Label } from "@rakhal/ui/ui/label";
import { Checkbox } from "@rakhal/ui/ui/checkbox";
import { Chip } from "@rakhal/ui/ui/chip";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  useAddToAnimalGroup,
  useAnimalGroups,
  useCreateAnimalGroup,
  useDeleteAnimalGroup,
  useRemoveFromAnimalGroup,
  useUpdateAnimalGroup,
} from "../hooks/use-cattle";
import { ANIMAL_CATEGORY_VARIANT } from "../utils/animal-category-style";
import type { AnimalGroup, CattleListItem } from "../types";

/** Moves focus into the input when it mounts. Module-level so its identity is stable: an inline arrow in `ref`
 * would run again on every render and pull focus back while the user types in another field. */
function focusOnMount(el: HTMLInputElement | null) {
  el?.focus();
}

export interface AnimalGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnimalGroupsDialog({ open, onOpenChange }: AnimalGroupsDialogProps) {
  const t = useTranslations("cattle.groups");
  const tCategory = useTranslations("cattle.animalCategory");
  const tBulk = useTranslations("cattle.bulk");
  const can = useCan();
  const canBulk = can("cattle.bulk");

  const [, setUrlAnimalGroupId] = useQueryState("animalGroupId", parseAsString);

  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<AnimalGroup | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [deleteTargetGroup, setDeleteTargetGroup] = useState<AnimalGroup | null>(null);

  // Group members state
  const [addAnimalsOpen, setAddAnimalsOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [removeTargetCattle, setRemoveTargetCattle] = useState<CattleListItem | null>(null);

  const groupsQuery = useAnimalGroups(search);
  const createGroup = useCreateAnimalGroup();
  const updateGroup = useUpdateAnimalGroup();
  const deleteGroup = useDeleteAnimalGroup();
  const addToGroup = useAddToAnimalGroup();
  const removeFromGroup = useRemoveFromAnimalGroup();

  const groups = groupsQuery.data?.items ?? [];
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  // Query group members when a group is open
  const groupMembersQuery = useQuery({
    queryKey: ["cattle", "list", { animalGroupId: selectedGroupId }],
    queryFn: () =>
      apiFetchPage<CattleListItem>("/cattle", {
        searchParams: { animalGroupId: selectedGroupId!, limit: 100 },
      }),
    enabled: Boolean(selectedGroupId),
  });

  const members = groupMembersQuery.data?.items ?? [];
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(
      (m) =>
        m.tagNumber.toLowerCase().includes(q) ||
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.breed?.name && m.breed.name.toLowerCase().includes(q)),
    );
  }, [members, memberSearch]);

  function startCreate() {
    setEditingGroup(null);
    setFormName("");
    setFormDescription("");
    setIsCreating(true);
  }

  function startEdit(group: AnimalGroup) {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDescription(group.description ?? "");
    setIsCreating(false);
  }

  function cancelForm() {
    setIsCreating(false);
    setEditingGroup(null);
    setFormName("");
    setFormDescription("");
  }

  async function handleSaveGroup() {
    const trimmedName = formName.trim();
    if (!trimmedName) return;

    try {
      if (editingGroup) {
        await updateGroup.mutateAsync({
          id: editingGroup.id,
          name: trimmedName,
          description: formDescription.trim() || undefined,
        });
        toast.success(t("updatedToast", { name: trimmedName }));
      } else {
        await createGroup.mutateAsync({
          name: trimmedName,
          description: formDescription.trim() || undefined,
        });
        toast.success(t("createdToast", { name: trimmedName }));
      }
      cancelForm();
    } catch {
      toast.error(editingGroup ? t("updateError") : t("createError"));
    }
  }

  async function handleDeleteGroup() {
    if (!deleteTargetGroup) return;
    try {
      await deleteGroup.mutateAsync(deleteTargetGroup.id);
      toast.success(t("deletedToast"));
      if (selectedGroupId === deleteTargetGroup.id) {
        setSelectedGroupId(null);
      }
      setDeleteTargetGroup(null);
    } catch {
      toast.error(t("deleteError"));
    }
  }

  async function handleRemoveMembers(cattleIds: string[]) {
    if (!selectedGroupId || cattleIds.length === 0) return;
    try {
      await removeFromGroup.mutateAsync({ groupId: selectedGroupId, cattleIds });
      toast.success(t("animalRemovedToast"));
      setSelectedMemberIds((prev) => prev.filter((id) => !cattleIds.includes(id)));
      setRemoveTargetCattle(null);
    } catch {
      toast.error(t("removeAnimalError"));
    }
  }

  function viewGroupInTable(groupId: string) {
    void setUrlAnimalGroupId(groupId);
    onOpenChange(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showClose={false}
          className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-0 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:max-w-3xl"
        >
          {selectedGroup ? (
            /* ---- GROUP MEMBERS VIEW ---- */
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedGroupId(null);
                        setSelectedMemberIds([]);
                        setMemberSearch("");
                      }}
                      aria-label="Back to groups"
                    >
                      <ArrowLeft className="size-4" />
                    </Button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SheetTitle className="text-lg font-bold truncate">{selectedGroup.name}</SheetTitle>
                        <Chip variant="muted" className="text-xs shrink-0">
                          {t("memberCount", { count: selectedGroup.memberCount })}
                        </Chip>
                      </div>
                      {selectedGroup.description ? (
                        <SheetDescription className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {selectedGroup.description}
                        </SheetDescription>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewGroupInTable(selectedGroup.id)}
                      className="gap-1.5 text-xs"
                    >
                      <ExternalLink className="size-3.5" />
                      {t("viewInTable")}
                    </Button>
                    {canBulk ? (
                      <Button
                        size="sm"
                        onClick={() => setAddAnimalsOpen(true)}
                        className="gap-1.5 text-xs"
                      >
                        <UserPlus className="size-3.5" />
                        {t("addAnimals")}
                      </Button>
                    ) : null}
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        aria-label="Close"
                      >
                        <X className="size-4" />
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex flex-1 flex-col overflow-hidden px-6 py-4">
                {/* Search & Bulk Remove Bar */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t("searchAnimalsPlaceholder")}
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  {canBulk && selectedMemberIds.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t("selectedCount", { count: selectedMemberIds.length })}
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => void handleRemoveMembers(selectedMemberIds)}
                      >
                        <UserMinus className="size-3.5" />
                        {t("removeAnimal")}
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Member Table */}
                <div className="flex-1 overflow-y-auto rounded-xl border border-border">
                  {groupMembersQuery.isLoading ? (
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title={members.length === 0 ? t("noMembersTitle") : t("emptyTitle")}
                      description={members.length === 0 ? t("noMembersDescription") : undefined}
                      action={
                        canBulk && members.length === 0 ? (
                          <Button size="sm" onClick={() => setAddAnimalsOpen(true)} className="gap-1.5 mt-2">
                            <Plus className="size-3.5" />
                            {t("addAnimals")}
                          </Button>
                        ) : null
                      }
                    />
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 border-b border-border bg-muted/60 text-muted-foreground">
                        <tr>
                          {canBulk ? (
                            <th className="w-8 px-3 py-2.5">
                              <Checkbox
                                checked={
                                  filteredMembers.length > 0 &&
                                  filteredMembers.every((m) => selectedMemberIds.includes(m.id))
                                }
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedMemberIds(filteredMembers.map((m) => m.id));
                                  } else {
                                    setSelectedMemberIds([]);
                                  }
                                }}
                                aria-label="Select all"
                              />
                            </th>
                          ) : null}
                          <th className="px-3 py-2.5 font-medium">{tBulk("groupNameLabel") || "Tag & Name"}</th>
                          <th className="px-3 py-2.5 font-medium">Category</th>
                          <th className="px-3 py-2.5 font-medium">Breed</th>
                          <th className="px-3 py-2.5 font-medium">Shed</th>
                          {canBulk ? <th className="w-16 px-3 py-2.5 text-right font-medium">Action</th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredMembers.map((cattle) => (
                          <tr key={cattle.id} className="transition-colors hover:bg-muted/40">
                            {canBulk ? (
                              <td className="px-3 py-2.5">
                                <Checkbox
                                  checked={selectedMemberIds.includes(cattle.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedMemberIds((prev) =>
                                      checked ? [...prev, cattle.id] : prev.filter((id) => id !== cattle.id),
                                    );
                                  }}
                                  aria-label={`Select ${cattle.tagNumber}`}
                                />
                              </td>
                            ) : null}
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-foreground">{cattle.tagNumber}</div>
                              {cattle.name ? (
                                <div className="text-xs text-muted-foreground">{cattle.name}</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5">
                              {cattle.animalCategory ? (
                                <Chip
                                  variant={ANIMAL_CATEGORY_VARIANT[cattle.animalCategory]}
                                  className="text-xs px-1.5 py-0.5"
                                >
                                  {tCategory(cattle.animalCategory)}
                                </Chip>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">{cattle.breed?.name ?? "—"}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{cattle.shed?.name ?? "—"}</td>
                            {canBulk ? (
                              <td className="px-3 py-2.5 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setRemoveTargetCattle(cattle)}
                                  title={t("removeAnimal")}
                                >
                                  <UserMinus className="size-3.5" />
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ---- ALL GROUPS LIST VIEW ---- */
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-xl font-bold flex items-center gap-2">
                      <Layers className="size-5 text-primary shrink-0" />
                      <span>{t("title")}</span>
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-xs text-muted-foreground">
                      {t("description")}
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canBulk && !isCreating && !editingGroup ? (
                      <Button onClick={startCreate} size="sm" className="gap-1.5">
                        <Plus className="size-4" />
                        {t("createGroup")}
                      </Button>
                    ) : null}
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        aria-label="Close"
                      >
                        <X className="size-4" />
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
                {/* Inline Create / Edit Box */}
                {(isCreating || editingGroup) && canBulk ? (
                  <div className="mb-4 rounded-xl border border-primary/30 bg-muted/30 p-4 shadow-xs">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">
                        {editingGroup ? t("editGroup") : t("createGroup")}
                      </h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground"
                        onClick={cancelForm}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="group-name-input">{t("groupName")}</Label>
                        <Input
                          id="group-name-input"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder={t("groupNamePlaceholder")}
                          maxLength={80}
                          ref={focusOnMount}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="group-desc-input">{t("descriptionLabel")}</Label>
                        <Input
                          id="group-desc-input"
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          placeholder={t("descriptionPlaceholder")}
                          maxLength={200}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={cancelForm}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!formName.trim() || createGroup.isPending || updateGroup.isPending}
                        onClick={() => void handleSaveGroup()}
                      >
                        {createGroup.isPending || updateGroup.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : null}

                {/* Search Bar */}
                {groups.length > 0 || search ? (
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search groups..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                ) : null}

                {/* Groups Grid */}
                {groupsQuery.isLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : groups.length === 0 ? (
                  <EmptyState
                    icon={Layers}
                    title={t("emptyTitle")}
                    description={t("emptyDescription")}
                    action={
                      canBulk ? (
                        <Button onClick={startCreate} className="mt-3 gap-1.5">
                          <Plus className="size-4" />
                          {t("createGroup")}
                        </Button>
                      ) : null
                    }
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-foreground text-sm leading-tight">
                              {group.name}
                            </h3>
                            <Chip variant="muted" className="shrink-0 text-xs font-medium">
                              {t("memberCount", { count: group.memberCount })}
                            </Chip>
                          </div>
                          {group.description ? (
                            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                              {group.description}
                            </p>
                          ) : (
                            <p className="mt-1.5 text-xs italic text-muted-foreground/60">
                              No description
                            </p>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-dashed border-border/80 pt-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => setSelectedGroupId(group.id)}
                          >
                            <Users className="size-3.5" />
                            {t("members")}
                          </Button>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              onClick={() => viewGroupInTable(group.id)}
                              title={t("viewInTable")}
                            >
                              <ExternalLink className="size-3.5" />
                            </Button>
                            {canBulk ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => startEdit(group)}
                                  title={t("editGroup")}
                                >
                                  <Edit2 className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteTargetGroup(group)}
                                  title={t("deleteGroup")}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Group Confirmation */}
      {deleteTargetGroup ? (
        <ConfirmDialog
          open={Boolean(deleteTargetGroup)}
          onOpenChange={(open) => !open && setDeleteTargetGroup(null)}
          title={t("deleteConfirm", { name: deleteTargetGroup.name })}
          description={t("deleteConfirmDescription")}
          confirmLabel={t("deleteGroup")}
          variant="destructive"
          onConfirm={handleDeleteGroup}
        />
      ) : null}

      {/* Remove Animal Confirmation */}
      {removeTargetCattle && selectedGroup ? (
        <ConfirmDialog
          open={Boolean(removeTargetCattle)}
          onOpenChange={(open) => !open && setRemoveTargetCattle(null)}
          title={t("removeConfirm")}
          description={t("removeConfirmDescription", {
            tagNumber: removeTargetCattle.tagNumber,
            name: selectedGroup.name,
          })}
          confirmLabel={t("removeAnimal")}
          variant="destructive"
          onConfirm={() => handleRemoveMembers([removeTargetCattle.id])}
        />
      ) : null}

      {/* Add Animals to Group Sub-Dialog */}
      {selectedGroup ? (
        <AddAnimalsToGroupDialog
          open={addAnimalsOpen}
          onOpenChange={setAddAnimalsOpen}
          group={selectedGroup}
          existingMemberIds={members.map((m) => m.id)}
        />
      ) : null}
    </>
  );
}

/** Search & pick animals to add to a group in bulk */
function AddAnimalsToGroupDialog({
  open,
  onOpenChange,
  group,
  existingMemberIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: AnimalGroup;
  existingMemberIds: string[];
}) {
  const t = useTranslations("cattle.groups");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const addToGroup = useAddToAnimalGroup();

  const allCattleQuery = useQuery({
    queryKey: ["cattle", "picker-list", search],
    queryFn: () =>
      apiFetchPage<CattleListItem>("/cattle", {
        searchParams: { search: search || undefined, limit: 100 },
      }),
    enabled: open,
  });

  const allCattle = allCattleQuery.data?.items ?? [];
  const availableCattle = allCattle.filter((c) => !existingMemberIds.includes(c.id));

  async function handleAdd() {
    if (selectedIds.length === 0) return;
    try {
      await addToGroup.mutateAsync({ groupId: group.id, cattleIds: selectedIds });
      toast.success(t("animalsAddedToast", { count: selectedIds.length }));
      setSelectedIds([]);
      onOpenChange(false);
    } catch {
      toast.error(t("addAnimalsError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addAnimalsTitle")}</DialogTitle>
          <DialogDescription>
            {t("addAnimalsDescription", { name: group.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchAnimalsPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              ref={focusOnMount}
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
            {allCattleQuery.isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : availableCattle.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {allCattle.length > 0 ? t("allAnimalsAlreadyInGroup") : "No animals found."}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {availableCattle.map((cattle) => {
                  const isChecked = selectedIds.includes(cattle.id);
                  return (
                    <label
                      key={cattle.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-muted/50",
                        isChecked && "bg-muted/80",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            setSelectedIds((prev) =>
                              checked ? [...prev, cattle.id] : prev.filter((id) => id !== cattle.id),
                            );
                          }}
                        />
                        <div>
                          <div className="font-semibold text-foreground">{cattle.tagNumber}</div>
                          {cattle.name ? (
                            <div className="text-xs text-muted-foreground">{cattle.name}</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {cattle.breed?.name ?? ""}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {availableCattle.length > 0 ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("selectedCount", { count: selectedIds.length })}</span>
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => {
                  if (selectedIds.length === availableCattle.length) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(availableCattle.map((c) => c.id));
                  }
                }}
              >
                {selectedIds.length === availableCattle.length ? "Deselect all" : "Select all"}
              </button>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={selectedIds.length === 0 || addToGroup.isPending}
            onClick={() => void handleAdd()}
          >
            {addToGroup.isPending ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
            {t("addSelected")} ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

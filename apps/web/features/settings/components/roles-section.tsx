"use client"; // dialog + matrix state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rakhal/ui/ui/dialog";
import { FloatingInput } from "@rakhal/ui/ui/floating-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rakhal/ui/ui/select";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useRoles } from "../hooks/use-team";
import {
  useCreateRole,
  useDeleteRole,
  useUpdateRolePermissions,
} from "../hooks/use-roles-mutations";
import { createRoleFormSchema, type CreateRoleFormInput } from "../schemas";
import type { PermissionCatalogueEntry, RoleOption } from "../types";
import { matrixToKeys, PermissionMatrixEditor } from "./permission-matrix-editor";

/**
 * Roles & Permissions (RFE-101).
 *
 * The Settings tab has been labelled "Team, Roles & Permissions" while rendering only a member
 * table — the whole roles API (RAKHAL-031) shipped with no UI and no consumer. This is it.
 *
 * The multi-tenant rule the UI has to make legible: a system role is one global row shared by
 * every farm, so it is shown read-only. A farm that wants a different Manager creates its own
 * role instead — which is exactly what the backend says on a 403, so the copy states it up
 * front rather than letting someone discover it by failing.
 */
export function RolesSection() {
  const t = useTranslations("settings.roles");
  const roles = useRoles();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RoleOption | null>(null);
  const [viewing, setViewing] = useState<RoleOption | null>(null);

  const catalogue = roles.data?.catalogue ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <p className="text-lg font-medium text-foreground">{t("title")}</p>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Can I="settings.roles-manage">
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" aria-hidden />
            {t("create")}
          </Button>
        </Can>
      </div>

      {roles.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : roles.isError ? (
        <ErrorState onRetry={() => void roles.refetch()} />
      ) : (roles.data?.roles.length ?? 0) === 0 ? (
        <EmptyState icon={ShieldCheck} title={t("empty")} description={t("emptyDescription")} />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {roles.data!.roles.map((role) => (
            <RoleRow
              key={role.id}
              role={role}
              onView={() => setViewing(role)}
              onEdit={() => setEditing(role)}
            />
          ))}
        </div>
      )}

      {/* Keyed so each open starts from a clean form and grid rather than an effect reset. */}
      {createOpen ? (
        <CreateRoleDialog
          onOpenChange={setCreateOpen}
          roles={roles.data?.roles ?? []}
          catalogue={catalogue}
        />
      ) : null}

      <EditRoleDialog
        role={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        catalogue={catalogue}
      />

      <ViewRoleDialog
        role={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        catalogue={catalogue}
      />
    </div>
  );
}

function RoleRow({
  role,
  onView,
  onEdit,
}: {
  role: RoleOption;
  onView: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("settings.roles");
  const deleteRole = useDeleteRole();

  const grantCount = useMemo(() => matrixToKeys(role.matrix).size, [role.matrix]);

  async function handleDelete() {
    try {
      await deleteRole.mutateAsync(role.id);
      toast.success(t("deleted", { name: role.name }));
    } catch (error) {
      // The backend refuses while members are still assigned and says how many — surface its
      // message rather than a generic failure, since it tells the user what to do next.
      toast.error(error instanceof ApiError ? error.message : t("deleteFailed"));
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{role.name}</span>
          <Badge variant={role.is_system ? "secondary" : "outline"}>
            {role.is_system ? t("system") : t("custom")}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("summary", { members: role.member_count, grants: grantCount })}
          {role.description ? ` · ${role.description}` : ""}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {role.editable ? (
          <Can I="settings.roles-manage">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              {t("editPermissions")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={deleteRole.isPending}
              onClick={() => void handleDelete()}
              aria-label={t("delete")}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </Can>
        ) : (
          <Button variant="ghost" size="sm" onClick={onView}>
            {t("view")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Read-only view of a system template, with the reason it cannot be edited. */
function ViewRoleDialog({
  role,
  onOpenChange,
  catalogue,
}: {
  role: RoleOption | null;
  onOpenChange: (open: boolean) => void;
  catalogue: PermissionCatalogueEntry[];
}) {
  const t = useTranslations("settings.roles");
  const keys = useMemo(() => (role ? matrixToKeys(role.matrix) : new Set<string>()), [role]);

  return (
    <Dialog open={Boolean(role)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role?.name}</DialogTitle>
          <DialogDescription>{t("systemReadOnly")}</DialogDescription>
        </DialogHeader>
        <PermissionMatrixEditor catalogue={catalogue} selectedKeys={keys} readOnly />
      </DialogContent>
    </Dialog>
  );
}

/** Keyed on the role id so each one mounts with its own grid state — seeding that from an
 * effect would mean rendering the previous role's grants for a frame. */
function EditRoleDialog({
  role,
  onOpenChange,
  catalogue,
}: {
  role: RoleOption | null;
  onOpenChange: (open: boolean) => void;
  catalogue: PermissionCatalogueEntry[];
}) {
  if (!role) return null;
  return (
    <EditRoleDialogInner
      key={role.id}
      role={role}
      onOpenChange={onOpenChange}
      catalogue={catalogue}
    />
  );
}

function EditRoleDialogInner({
  role,
  onOpenChange,
  catalogue,
}: {
  role: RoleOption;
  onOpenChange: (open: boolean) => void;
  catalogue: PermissionCatalogueEntry[];
}) {
  const t = useTranslations("settings.roles");
  const update = useUpdateRolePermissions();
  const [keys, setKeys] = useState<Set<string>>(() => matrixToKeys(role.matrix));

  async function handleSave() {
    try {
      await update.mutateAsync({ roleId: role.id, permissionKeys: [...keys] });
      toast.success(t("saved", { name: role.name }));
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("saveFailed"));
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editTitle", { name: role.name })}</DialogTitle>
          <DialogDescription>{t("editDescription")}</DialogDescription>
        </DialogHeader>

        <PermissionMatrixEditor catalogue={catalogue} selectedKeys={keys} onChange={setKeys} />

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void handleSave()} disabled={update.isPending}>
            {update.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateRoleDialog({
  onOpenChange,
  roles,
  catalogue,
}: {
  onOpenChange: (open: boolean) => void;
  roles: RoleOption[];
  catalogue: PermissionCatalogueEntry[];
}) {
  const t = useTranslations("settings.roles");
  const create = useCreateRole();
  const [keys, setKeys] = useState<Set<string>>(() => {
    const template = roles.find((r) => r.is_system && r.name.toLowerCase() === "worker");
    return template ? matrixToKeys(template.matrix) : new Set<string>();
  });

  const form = useForm<CreateRoleFormInput>({
    resolver: zodResolver(createRoleFormSchema),
    defaultValues: { name: "", description: "", base_role: "worker" },
  });

  const baseRole = form.watch("base_role");

  // Re-seed the grid when the base template changes. Adjusting state during render is
  // React's documented pattern for derived state; doing it in an effect would render one
  // frame of the previous template's grants and trips `react-hooks/set-state-in-effect`.
  const [seededFrom, setSeededFrom] = useState(baseRole);
  if (seededFrom !== baseRole) {
    setSeededFrom(baseRole);
    const template = roles.find(
      (r) => r.is_system && r.name.toLowerCase() === baseRole.toLowerCase(),
    );
    setKeys(template ? matrixToKeys(template.matrix) : new Set<string>());
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        // Concrete keys rather than the base role: the user may have edited the grid after
        // picking a template, and the backend treats these as the complete grant set.
        permission_keys: [...keys],
      });
      toast.success(t("created", { name: values.name }));
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Reserved system name, or one this farm already uses.
        form.setError("name", { message: error.message });
        return;
      }
      toast.error(error instanceof ApiError ? error.message : t("createFailed"));
    }
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
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

          <Controller
            control={form.control}
            name="base_role"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">
                  {t("baseRoleLabel")}
                </label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worker">{t("baseWorker")}</SelectItem>
                    <SelectItem value="manager">{t("baseManager")}</SelectItem>
                    <SelectItem value="owner">{t("baseOwner")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("baseRoleHint")}</p>
              </div>
            )}
          />

          <PermissionMatrixEditor catalogue={catalogue} selectedKeys={keys} onChange={setKeys} />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

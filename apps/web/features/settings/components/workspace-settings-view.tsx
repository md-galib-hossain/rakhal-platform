"use client"; // forms + mutations + dialogs

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FloatingInput } from "@/components/ui/floating-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useFarmSettings, useFeedGroups, useSheds } from "../hooks/use-workspace";
import {
  useCreateFeedGroup,
  useCreateShed,
  useDeleteFeedGroup,
  useDeleteShed,
  useUpdateFarm,
  useUpdateFeedGroup,
  useUpdateShed,
} from "../hooks/use-workspace-mutations";
import {
  feedGroupFormSchema,
  shedFormSchema,
  updateFarmSchema,
  type FeedGroupFormInput,
  type ShedFormInput,
  type UpdateFarmInput,
} from "../schemas";
import type { FeedGroup, Shed } from "../types";

const SHED_PURPOSES = ["MILKING", "HEIFER", "DRY", "CALF", "QUARANTINE", "GENERAL"] as const;

export function WorkspaceSettingsView() {
  return (
    <div className="flex flex-col gap-10">
      <FarmProfileSection />
      <ShedsSection />
      <FeedGroupsSection />
    </div>
  );
}

// ── Farm profile ──────────────────────────────────────────────────────────

function FarmProfileSection() {
  const t = useTranslations("settings.workspace.farm");
  const farm = useFarmSettings();
  const updateFarm = useUpdateFarm();
  const form = useForm<UpdateFarmInput>({
    resolver: zodResolver(updateFarmSchema),
    defaultValues: { farm_name: "", description: "", division: "", district: "", upazila: "", operational_purpose: "" },
  });

  useEffect(() => {
    if (!farm.data) return;
    form.reset({
      farm_name: farm.data.farm_name,
      description: farm.data.description ?? "",
      division: farm.data.division ?? "",
      district: farm.data.district ?? "",
      upazila: farm.data.upazila ?? "",
      operational_purpose: farm.data.operational_purpose ?? "",
    });
  }, [farm.data, form]);

  if (farm.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (farm.isError) {
    return <ErrorState description={t("loadError")} onRetry={() => farm.refetch()} />;
  }

  async function onSubmit(values: UpdateFarmInput) {
    try {
      await updateFarm.mutateAsync(values);
      toast.success(t("savedToast"));
    } catch (err) {
      form.setError("root", { message: err instanceof ApiError ? err.message : t("genericError") });
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {form.formState.errors.root ? (
          <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <FloatingInput
            id="workspace-farm-name"
            label={t("farmName")}
            error={form.formState.errors.farm_name?.message}
            {...form.register("farm_name")}
          />
          <FloatingInput id="workspace-farm-id" label={t("farmId")} value={farm.data?.farm_id ?? ""} disabled readOnly />
          <FloatingInput id="workspace-division" label={t("division")} {...form.register("division")} />
          <FloatingInput id="workspace-district" label={t("district")} {...form.register("district")} />
          <FloatingInput id="workspace-upazila" label={t("upazila")} {...form.register("upazila")} />
          <FloatingInput id="workspace-purpose" label={t("purpose")} {...form.register("operational_purpose")} />
        </div>
        <FloatingInput id="workspace-description" label={t("description")} {...form.register("description")} />
        <Can I="settings.update">
          <div className="flex justify-end">
            <Button type="submit" disabled={updateFarm.isPending}>
              {updateFarm.isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </Can>
      </form>
    </section>
  );
}

// ── Sheds ─────────────────────────────────────────────────────────────────

function ShedsSection() {
  const t = useTranslations("settings.workspace.sheds");
  const sheds = useSheds();
  const deleteShed = useDeleteShed();
  const [dialogTarget, setDialogTarget] = useState<Shed | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shed | null>(null);

  if (sheds.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (sheds.isError) {
    return <ErrorState description={t("loadError")} onRetry={() => sheds.refetch()} />;
  }

  const rows = sheds.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
        <Can I="settings.update">
          <Button onClick={() => setDialogTarget("new")} className="gap-1.5" size="sm">
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        </Can>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("nameHeader")}</TableHead>
              <TableHead>{t("purposeHeader")}</TableHead>
              <TableHead>{t("capacityHeader")}</TableHead>
              <TableHead>{t("occupancyHeader")}</TableHead>
              <TableHead>{t("actionsHeader")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                <TableCell>
                  {row.purpose ? <Badge variant="outline">{t(`purposeValues.${row.purpose}`)}</Badge> : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.capacity ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.current_count}</TableCell>
                <TableCell>
                  <Can I="settings.update">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDialogTarget(row)}>{t("edit")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(row)} className="text-destructive">
                          {t("deactivate")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ShedFormDialog
        open={dialogTarget !== null}
        onOpenChange={(open) => !open && setDialogTarget(null)}
        shed={dialogTarget !== "new" ? dialogTarget : null}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deactivateConfirmTitle", { name: deleteTarget?.name ?? "" })}
        body={t("deactivateConfirmBody")}
        pending={deleteShed.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteShed.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(t("deactivatedToast"));
              setDeleteTarget(null);
            },
            onError: (err) => {
              toast.error(err instanceof ApiError ? err.message : t("genericError"));
            },
          });
        }}
      />
    </section>
  );
}

function ShedFormDialog({
  open,
  onOpenChange,
  shed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shed: Shed | null;
}) {
  const t = useTranslations("settings.workspace.sheds");
  const createShed = useCreateShed();
  const updateShed = useUpdateShed();
  const form = useForm<ShedFormInput>({
    resolver: zodResolver(shedFormSchema),
    defaultValues: { name: "", code: "", description: "", capacity: "", purpose: "GENERAL" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      shed
        ? {
            name: shed.name,
            code: shed.code ?? "",
            description: shed.description ?? "",
            capacity: shed.capacity != null ? String(shed.capacity) : "",
            purpose: shed.purpose ?? "GENERAL",
          }
        : { name: "", code: "", description: "", capacity: "", purpose: "GENERAL" },
    );
  }, [open, shed, form]);

  async function onSubmit(values: ShedFormInput) {
    try {
      if (shed) {
        await updateShed.mutateAsync({ id: shed.id, input: values });
      } else {
        await createShed.mutateAsync(values);
      }
      toast.success(shed ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      form.setError("root", { message: err instanceof ApiError ? err.message : t("genericError") });
    }
  }

  const pending = createShed.isPending || updateShed.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{shed ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {form.formState.errors.root ? (
            <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <FloatingInput
            id="shed-name"
            label={t("nameLabel")}
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <FloatingInput
            id="shed-capacity"
            type="number"
            label={t("capacityLabel")}
            error={form.formState.errors.capacity?.message}
            {...form.register("capacity")}
          />
          <Controller
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("purposeLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {SHED_PURPOSES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`purposeValues.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FloatingInput id="shed-description" label={t("descriptionLabel")} {...form.register("description")} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Feed groups ───────────────────────────────────────────────────────────

function FeedGroupsSection() {
  const t = useTranslations("settings.workspace.feedGroups");
  const groups = useFeedGroups();
  const deleteGroup = useDeleteFeedGroup();
  const [dialogTarget, setDialogTarget] = useState<FeedGroup | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedGroup | null>(null);

  if (groups.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (groups.isError) {
    return <ErrorState description={t("loadError")} onRetry={() => groups.refetch()} />;
  }

  const rows = groups.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
        <Can I="settings.update">
          <Button onClick={() => setDialogTarget("new")} className="gap-1.5" size="sm">
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        </Can>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("nameHeader")}</TableHead>
              <TableHead>{t("assignedHeader")}</TableHead>
              <TableHead>{t("actionsHeader")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.assigned_count}</TableCell>
                <TableCell>
                  <Can I="settings.update">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDialogTarget(row)}>{t("edit")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(row)} className="text-destructive">
                          {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <FeedGroupFormDialog
        open={dialogTarget !== null}
        onOpenChange={(open) => !open && setDialogTarget(null)}
        group={dialogTarget !== "new" ? dialogTarget : null}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteConfirmTitle", { name: deleteTarget?.name ?? "" })}
        body={t("deleteConfirmBody")}
        pending={deleteGroup.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteGroup.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(t("deletedToast"));
              setDeleteTarget(null);
            },
            onError: (err) => {
              toast.error(err instanceof ApiError ? err.message : t("genericError"));
            },
          });
        }}
      />
    </section>
  );
}

function FeedGroupFormDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: FeedGroup | null;
}) {
  const t = useTranslations("settings.workspace.feedGroups");
  const createGroup = useCreateFeedGroup();
  const updateGroup = useUpdateFeedGroup();
  const form = useForm<FeedGroupFormInput>({
    resolver: zodResolver(feedGroupFormSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(group ? { name: group.name, description: group.description ?? "" } : { name: "", description: "" });
  }, [open, group, form]);

  async function onSubmit(values: FeedGroupFormInput) {
    try {
      if (group) {
        await updateGroup.mutateAsync({ id: group.id, input: values });
      } else {
        await createGroup.mutateAsync(values);
      }
      toast.success(group ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      form.setError("root", { message: err instanceof ApiError ? err.message : t("genericError") });
    }
  }

  const pending = createGroup.isPending || updateGroup.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {form.formState.errors.root ? (
            <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <FloatingInput
            id="feed-group-name"
            label={t("nameLabel")}
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <FloatingInput id="feed-group-description" label={t("descriptionLabel")} {...form.register("description")} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations("settings.workspace");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

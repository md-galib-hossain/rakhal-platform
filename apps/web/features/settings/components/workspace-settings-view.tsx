"use client"; // forms + mutations + dialogs

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@rakhal/ui/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FloatingInput } from "@rakhal/ui/ui/floating-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rakhal/ui/ui/select";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useFarmSettings, useSheds } from "../hooks/use-workspace";
import {
  useCreateShed,
  useDeleteShed,
  useUpdateFarm,
  useUpdateShed,
} from "../hooks/use-workspace-mutations";
import {
  shedFormSchema,
  updateFarmSchema,
  type ShedFormInput,
  type UpdateFarmInput,
} from "../schemas";
import type { Shed } from "../types";
import { timezoneOptions } from "../timezones";

const SHED_PURPOSES = ["MILKING", "HEIFER", "DRY", "CALF", "QUARANTINE", "GENERAL"] as const;

export function WorkspaceSettingsView() {
  return (
    <div className="flex flex-col gap-10">
      <FarmProfileSection />
      <ShedsSection />
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
    defaultValues: {
      farm_name: "",
      description: "",
      division: "",
      district: "",
      upazila: "",
      operational_purpose: "",
      timezone: "Asia/Dhaka",
    },
  });

  useEffect(() => {
    if (!farm.data) return;
    form.reset({
      timezone: farm.data.timezone,
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
        <div className="flex flex-col gap-1.5">
          <Controller
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label={t("timezone")}>
                  <SelectValue placeholder={t("timezone")} />
                </SelectTrigger>
                <SelectContent>
                  {timezoneOptions(farm.data?.timezone).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">{t("timezoneHint")}</p>
        </div>
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{shed ? t("editTitle") : t("addTitle")}</SheetTitle>
          <SheetDescription>{t("dialogDescription")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4" noValidate>
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
          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{body}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="border-t border-dashed border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

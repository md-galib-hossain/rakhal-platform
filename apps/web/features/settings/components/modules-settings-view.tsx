"use client"; // forms + mutations + dialogs

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useSuppliers } from "../hooks/use-workspace";
import { useCreateSupplier, useDeleteSupplier, useUpdateSupplier } from "../hooks/use-workspace-mutations";
import { supplierFormSchema, type SupplierFormInput } from "../schemas";
import type { Supplier } from "../types";

/**
 * RFE-045b's remaining "Module settings" toggle editor (PRD §21.5) isn't built yet — this view
 * currently covers only the Suppliers CRUD half of the tab (RFE-045c, PRD §21.6), same reasoning
 * `workspace-settings-view.tsx` already documents for its own multi-ticket split.
 */
export function ModulesSettingsView() {
  return (
    <div className="flex flex-col gap-10">
      <SuppliersSection />
    </div>
  );
}

function SuppliersSection() {
  const t = useTranslations("settings.modules.suppliers");
  const suppliers = useSuppliers();
  const deleteSupplier = useDeleteSupplier();
  const [dialogTarget, setDialogTarget] = useState<Supplier | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  if (suppliers.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (suppliers.isError) {
    return <ErrorState description={t("loadError")} onRetry={() => suppliers.refetch()} />;
  }

  const rows = suppliers.data?.suppliers ?? [];

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
              <TableHead>{t("contactHeader")}</TableHead>
              <TableHead>{t("categoryHeader")}</TableHead>
              <TableHead>{t("paymentTermsHeader")}</TableHead>
              <TableHead>{t("actionsHeader")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[row.contact, row.phone].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.category ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.payment_terms ?? "—"}</TableCell>
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

      <SupplierFormDialog
        open={dialogTarget !== null}
        onOpenChange={(open) => !open && setDialogTarget(null)}
        supplier={dialogTarget !== "new" ? dialogTarget : null}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deactivateConfirmTitle", { name: deleteTarget?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("deactivateConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteSupplier.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteSupplier.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success(t("deactivatedToast"));
                    setDeleteTarget(null);
                  },
                  onError: (err) => {
                    toast.error(err instanceof ApiError ? err.message : t("genericError"));
                  },
                });
              }}
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}) {
  const t = useTranslations("settings.modules.suppliers");
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const form = useForm<SupplierFormInput>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: { name: "", contact: "", phone: "", category: "", payment_terms: "", notes: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      supplier
        ? {
            name: supplier.name,
            contact: supplier.contact ?? "",
            phone: supplier.phone ?? "",
            category: supplier.category ?? "",
            payment_terms: supplier.payment_terms ?? "",
            notes: supplier.notes ?? "",
          }
        : { name: "", contact: "", phone: "", category: "", payment_terms: "", notes: "" },
    );
  }, [open, supplier, form]);

  async function onSubmit(values: SupplierFormInput) {
    try {
      if (supplier) {
        await updateSupplier.mutateAsync({ id: supplier.id, input: values });
      } else {
        await createSupplier.mutateAsync(values);
      }
      toast.success(supplier ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      form.setError("root", { message: err instanceof ApiError ? err.message : t("genericError") });
    }
  }

  const pending = createSupplier.isPending || updateSupplier.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {form.formState.errors.root ? (
            <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <FloatingInput
            id="supplier-name"
            label={t("nameLabel")}
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingInput id="supplier-contact" label={t("contactLabel")} {...form.register("contact")} />
            <FloatingInput id="supplier-phone" label={t("phoneLabel")} {...form.register("phone")} />
            <FloatingInput id="supplier-category" label={t("categoryLabel")} {...form.register("category")} />
            <FloatingInput id="supplier-payment-terms" label={t("paymentTermsLabel")} {...form.register("payment_terms")} />
          </div>
          <FloatingInput id="supplier-notes" label={t("notesLabel")} {...form.register("notes")} />
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

"use client"; // forms + mutations + dialogs

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SupplierFormDialog } from "@/features/suppliers/components/supplier-form-dialog";
import { useSuppliers } from "../hooks/use-workspace";
import { useDeleteSupplier } from "../hooks/use-workspace-mutations";
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

      <Sheet open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t("deactivateConfirmTitle", { name: deleteTarget?.name ?? "" })}</SheetTitle>
            <SheetDescription>{t("deactivateConfirmBody")}</SheetDescription>
          </SheetHeader>
          <SheetFooter className="border-t border-dashed border-border pt-4">
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
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

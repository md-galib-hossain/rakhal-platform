"use client"; // form state + mutation

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FloatingInput } from "@/components/ui/floating-input";
import { useCreateSupplier, useUpdateSupplier } from "@/features/settings/hooks/use-workspace-mutations";
import { supplierFormSchema, type SupplierFormInput } from "@/features/settings/schemas";
import { useInvalidateSuppliersV2 } from "../hooks";

/**
 * RAKHAL-390 — the one supplier create/edit sheet. Writes go through the existing `/settings/suppliers`
 * CRUD (`useCreateSupplier`/`useUpdateSupplier`, `features/settings/**`), then refresh this module's
 * own read model too (`useInvalidateSuppliersV2`). Shared by the Purchasing → Suppliers tab and
 * Settings → Modules (which used to carry an identical private copy under its own i18n namespace) —
 * callers gate the entry point (`useCanAddSupplier` / `settings.update`), the dialog itself does not.
 */
export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: { id: string; name: string; contact: string | null; phone: string | null; category: string | null; payment_terms: string | null; notes: string | null } | null;
}) {
  const t = useTranslations("suppliers.form");
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const invalidateSuppliersV2 = useInvalidateSuppliersV2();

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
      invalidateSuppliersV2();
      toast.success(supplier ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      form.setError("root", { message: err instanceof ApiError ? err.message : t("genericError") });
    }
  }

  const pending = createSupplier.isPending || updateSupplier.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{supplier ? t("editTitle") : t("addTitle")}</SheetTitle>
          <SheetDescription>{t("dialogDescription")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4" noValidate>
          {form.formState.errors.root ? (
            <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <FloatingInput id="supplier-name" label={t("nameLabel")} error={form.formState.errors.name?.message} {...form.register("name")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingInput id="supplier-contact" label={t("contactLabel")} {...form.register("contact")} />
            <FloatingInput id="supplier-phone" label={t("phoneLabel")} {...form.register("phone")} />
            <FloatingInput id="supplier-category" label={t("categoryLabel")} {...form.register("category")} />
            <FloatingInput id="supplier-payment-terms" label={t("paymentTermsLabel")} {...form.register("payment_terms")} />
          </div>
          <FloatingInput id="supplier-notes" label={t("notesLabel")} {...form.register("notes")} />
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

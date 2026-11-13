"use client"; // form state + mutation

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import type { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { useCreateSupplier } from "@/features/settings/hooks/use-workspace-mutations";
import { supplierFormSchema } from "@/features/settings/schemas";
import type { Supplier } from "@/features/settings/types";
import { useInvalidateSuppliersV2 } from "../hooks";

const quickSupplierSchema = supplierFormSchema.pick({ name: true, phone: true });
type QuickSupplierInput = z.infer<typeof quickSupplierSchema>;

/**
 * Quick "add supplier" from inside Record Purchase — name and phone only, the same shape as
 * `QuickAddBuyerSheet`. The full `SupplierFormDialog` (contact, category, payment terms, notes) stays
 * on the Suppliers tab; a farmer at the counter only needs a counterparty to book this purchase to.
 *
 * Non-modal: it opens on top of the purchase sheet and a second modal layer would fight it for the
 * scroll lock (same reason as `QuickAddBuyerSheet`).
 */
export function QuickAddSupplierSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: Supplier) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? <QuickAddSupplierBody onOpenChange={onOpenChange} onCreated={onCreated} /> : null}
    </Sheet>
  );
}

function QuickAddSupplierBody({
  onOpenChange,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: Supplier) => void;
}) {
  const t = useTranslations("suppliers.quickAdd");
  const createSupplier = useCreateSupplier();
  const invalidateSuppliersV2 = useInvalidateSuppliersV2();

  const form = useForm<QuickSupplierInput>({
    resolver: zodResolver(quickSupplierSchema),
    defaultValues: { name: "", phone: "" },
  });

  async function onSubmit(values: QuickSupplierInput) {
    try {
      const created = await createSupplier.mutateAsync({ name: values.name, phone: values.phone || "" });
      invalidateSuppliersV2();
      toast.success(t("createdToast"));
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[480px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[480px]"
    >
      <div className="flex items-center justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("cancel")}
          className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />
      <form
        onSubmit={(event) => {
          // React bubbles portal events through the React tree — keep this submit from reaching the
          // purchase form that rendered the picker.
          event.stopPropagation();
          void form.handleSubmit(onSubmit)(event);
        }}
        className="flex flex-1 flex-col overflow-y-auto"
        noValidate
      >
        <div className="flex flex-1 flex-col gap-4 px-1 py-4">
          <LabeledInput
            id="quickSupplierName"
            label={t("name")}
            error={form.formState.errors.name ? t("nameRequired") : undefined}
            {...form.register("name")}
          />
          <LabeledInput id="quickSupplierPhone" type="tel" label={t("phone")} {...form.register("phone")} />
          <p className="text-xs text-muted-foreground">{t("moreLater")}</p>
        </div>
        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 px-1 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={createSupplier.isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={createSupplier.isPending}>
            {createSupplier.isPending ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}

"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRecordDispatch } from "../hooks/use-buyers";
import { recordDispatchSchema, type RecordDispatchInput } from "../schemas";
import { BuyerPicker } from "./buyer-picker";
import type { Buyer } from "../types";
import { DatePicker } from "@/components/ui/date-picker";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Record Dispatch (PRD §11.2 — the module's core action). No Figma frame — built against the real
 * `RecordDispatchDto`. Server-side this also decrements the Inventory SELLABLE tank (SALE) and
 * creates a Finance receivable — both surfaced via the success toast's real returned amount, not
 * fabricated.
 *
 * Right-side sheet — same floating-card chrome as `BuyerFormDialog`/`EquipmentFormDialog` (10px
 * inset, 20px radius, 2px border, `arrow-right-03` header icon). Was previously a centered
 * `Dialog` — moved to match every other form's side-sheet pattern in the app.
 */
export function RecordDispatchDialog({
  buyer,
  open,
  onOpenChange,
}: {
  buyer: Buyer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? <RecordDispatchDialogBody key={buyer?.id ?? "no-buyer"} buyer={buyer} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function RecordDispatchDialogBody({
  buyer,
  onOpenChange,
}: {
  buyer: Buyer | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("buyers.dispatch");
  const recordDispatch = useRecordDispatch();

  const form = useForm<RecordDispatchInput>({
    resolver: zodResolver(recordDispatchSchema),
    values: { buyerId: buyer?.id ?? "", dispatchedAt: today(), volumeDispatchedL: 0 },
  });

  async function onSubmit(values: RecordDispatchInput) {
    try {
      const result = await recordDispatch.mutateAsync(values);
      toast.success(t("successToast", { amount: result.calculatedAmount }));
      form.reset({ buyerId: buyer?.id ?? "", dispatchedAt: today(), volumeDispatchedL: 0 });
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

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
          {buyer ? (
            <div className="space-y-1.5">
              <Label>{t("buyer")}</Label>
              <p className="text-sm font-medium text-foreground">{buyer.name}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Controller
                control={form.control}
                name="buyerId"
                render={({ field, fieldState }) => (
                  <BuyerPicker
                    value={field.value}
                    onChange={(id) => field.onChange(id)}
                    placeholder={t("buyerPlaceholder")}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="dispatchedAt">{t("dispatchedAt")}</Label>
            <Controller
              control={form.control}
              name="dispatchedAt"
              render={({ field, fieldState }) => (
                <DatePicker
                  id="dispatchedAt"
                  label={t("dispatchedAt")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="volumeDispatchedL">{t("volumeDispatchedL")}</Label>
              <Input
                id="volumeDispatchedL"
                type="number"
                step="0.01"
                min={0}
                error={form.formState.errors.volumeDispatchedL?.message}
                {...form.register("volumeDispatchedL", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="volumeReceivedL">{t("volumeReceivedL")}</Label>
              <Input
                id="volumeReceivedL"
                type="number"
                step="0.01"
                min={0}
                {...form.register("volumeReceivedL", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fatPct">{t("fatPct")}</Label>
              <Input
                id="fatPct"
                type="number"
                step="0.1"
                min={0}
                {...form.register("fatPct", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scc">{t("scc")}</Label>
              <Input
                id="scc"
                type="number"
                min={0}
                {...form.register("scc", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Input id="notes" {...form.register("notes")} />
          </div>
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={recordDispatch.isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={recordDispatch.isPending}>
            {recordDispatch.isPending ? t("saving") : t("submit")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}

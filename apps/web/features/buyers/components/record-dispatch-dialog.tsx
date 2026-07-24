"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuyersPagedList, useRecordDispatch } from "../hooks/use-buyers";
import { recordDispatchSchema, type RecordDispatchInput } from "../schemas";
import type { Buyer } from "../types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Record Dispatch (PRD §11.2 — the module's core action). No Figma frame — built against the real
 * `RecordDispatchDto`. Server-side this also decrements the Inventory SELLABLE tank (SALE) and
 * creates a Finance receivable — both surfaced via the success toast's real returned amount, not
 * fabricated.
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
  const t = useTranslations("buyers.dispatch");
  const recordDispatch = useRecordDispatch();
  // Buyer picker only needed when opened from the Dispatch History tab (no pre-selected buyer);
  // when opened from a buyer row, `buyer` is already fixed and this list isn't rendered.
  const buyersList = useBuyersPagedList({});

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {buyer ? (
            <div className="space-y-1.5">
              <Label>{t("buyer")}</Label>
              <p className="text-sm font-medium text-foreground">{buyer.name}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{t("buyer")}</Label>
              <Controller
                control={form.control}
                name="buyerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("buyerPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {buyersList.items.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.buyerId ? (
                <p className="text-sm text-destructive">{form.formState.errors.buyerId.message}</p>
              ) : null}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="dispatchedAt">{t("dispatchedAt")}</Label>
            <Input id="dispatchedAt" type="date" {...form.register("dispatchedAt")} />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={recordDispatch.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={recordDispatch.isPending}>
              {recordDispatch.isPending ? t("saving") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

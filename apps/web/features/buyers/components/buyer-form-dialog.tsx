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
import { useCreateBuyer, useUpdateBuyer } from "../hooks/use-buyers";
import { BUYER_TYPES, buyerFormSchema, type BuyerFormInput } from "../schemas";
import type { Buyer } from "../types";

/**
 * Create/Edit Buyer — one dialog for both (same pattern as `CattleFormDialog`). No Figma frame
 * for this module (RFE-026: "Design: Figma if present, else PRD-spec") — built against the real
 * `CreateBuyerDto`/`UpdateBuyerDto`.
 */
export function BuyerFormDialog({
  buyer,
  open,
  onOpenChange,
}: {
  buyer: Buyer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("buyers.form");
  const createBuyer = useCreateBuyer();
  const updateBuyer = useUpdateBuyer();
  const isEdit = buyer != null;
  const isPending = createBuyer.isPending || updateBuyer.isPending;

  const form = useForm<BuyerFormInput>({
    resolver: zodResolver(buyerFormSchema),
    values: buyer
      ? {
          name: buyer.name,
          contactPerson: buyer.contactPerson ?? undefined,
          phone: buyer.phone ?? undefined,
          email: buyer.email ?? undefined,
          buyerType: buyer.buyerType,
          paymentTermsDays: buyer.paymentTermsDays,
          basePricePerLitre: buyer.basePricePerLitre,
          baseFatPct: buyer.baseFatPct,
          fatBonusPer01Pct: buyer.fatBonusPer01Pct,
          sccThreshold: buyer.sccThreshold,
          sccPenaltyPer100k: buyer.sccPenaltyPer100k,
          collectionTime: buyer.collectionTime ?? undefined,
          bankDetails: buyer.bankDetails ?? undefined,
        }
      : { name: "", buyerType: "DAIRY_COMPANY", basePricePerLitre: 0 },
  });

  async function onSubmit(values: BuyerFormInput) {
    try {
      if (isEdit) {
        await updateBuyer.mutateAsync({ id: buyer.id, dto: values });
        toast.success(t("updatedToast"));
      } else {
        await createBuyer.mutateAsync(values);
        toast.success(t("createdToast"));
        form.reset({ name: "", buyerType: "DAIRY_COMPANY", basePricePerLitre: 0 });
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" error={form.formState.errors.name?.message} {...form.register("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("buyerType")}</Label>
            <Controller
              control={form.control}
              name="buyerType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUYER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`typeOptions.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contactPerson">{t("contactPerson")}</Label>
              <Input id="contactPerson" {...form.register("contactPerson")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" type="email" {...form.register("email")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="basePricePerLitre">{t("basePricePerLitre")}</Label>
              <Input
                id="basePricePerLitre"
                type="number"
                step="0.01"
                min={0}
                error={form.formState.errors.basePricePerLitre?.message}
                {...form.register("basePricePerLitre", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentTermsDays">{t("paymentTermsDays")}</Label>
              <Input
                id="paymentTermsDays"
                type="number"
                min={0}
                {...form.register("paymentTermsDays", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="baseFatPct">{t("baseFatPct")}</Label>
              <Input
                id="baseFatPct"
                type="number"
                step="0.1"
                min={0}
                {...form.register("baseFatPct", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fatBonusPer01Pct">{t("fatBonusPer01Pct")}</Label>
              <Input
                id="fatBonusPer01Pct"
                type="number"
                step="0.01"
                min={0}
                {...form.register("fatBonusPer01Pct", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sccThreshold">{t("sccThreshold")}</Label>
              <Input
                id="sccThreshold"
                type="number"
                min={0}
                {...form.register("sccThreshold", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sccPenaltyPer100k">{t("sccPenaltyPer100k")}</Label>
              <Input
                id="sccPenaltyPer100k"
                type="number"
                step="0.01"
                min={0}
                {...form.register("sccPenaltyPer100k", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankDetails">{t("bankDetails")}</Label>
            <Input id="bankDetails" {...form.register("bankDetails")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : isEdit ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client"; // form state

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Banknote, Landmark, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Button } from "@/components/ui/button";
import { useAddFunds } from "../hooks/use-finance";
import { addFundsSchema, type AddFundsInput } from "../schemas";
import type { FinancePaymentMethod } from "../types";

const METHOD_ICON: Record<FinancePaymentMethod, React.ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  BANK_TRANSFER: Landmark,
  MFS: Smartphone,
};
const METHODS: FinancePaymentMethod[] = ["CASH", "BANK_TRANSFER", "MFS"];

/**
 * "Add Funds to Wallet" — Figma `1039:32932` (file `SCfMPdxP6vgW1uTxfqCtz7`). Mirrors `AddFundsDto`.
 * Real gap vs the mock, flagged not fabricated: the mock's first input is labeled "Fund Name" but
 * `AddFundsDto` has no matching field — only `description` — mapped onto that real field (the label
 * stays "Fund Name" per Figma, the wire field is `description`). No `<Sheet>` wrapper — shares one
 * with `WalletDialogContent`/`WithdrawDialogContent`, see that file's doc comment for why.
 */
export function AddFundsDialogContent({ onBack }: { onBack: () => void }) {
  const t = useTranslations("finance.addFunds");
  const addFunds = useAddFunds();

  const form = useForm<AddFundsInput>({
    resolver: zodResolver(addFundsSchema),
    defaultValues: { paymentMethod: "CASH" },
  });

  async function onSubmit(values: AddFundsInput) {
    try {
      await addFunds.mutateAsync(values);
      toast.success(t("addedToast"));
      form.reset({ paymentMethod: "CASH" });
      onBack();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[560px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[560px]"
    >
      <div className="flex items-center gap-2 pb-5">
        <button type="button" onClick={onBack} aria-label={t("back")} className="flex size-6 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
      </div>
      <div className="border-t border-dashed border-border" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-5">
          <LabeledInput id="description" label={t("fundName")} placeholder={t("fundNamePlaceholder")} {...form.register("description")} error={form.formState.errors.description?.message} />
          <LabeledInput
            id="amount"
            type="number"
            step="0.01"
            min={0}
            label={t("amount")}
            placeholder="0.00"
            {...form.register("amount", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
            error={form.formState.errors.amount?.message}
          />

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">{t("paymentMethod")}</p>
            <Controller
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  {METHODS.map((method) => {
                    const Icon = METHOD_ICON[method];
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => field.onChange(method)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          field.value === method ? "border-primary bg-success-tint" : "border-border",
                        )}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{t(`methods.${method}.label`)}</span>
                          <span className="text-xs text-muted-foreground">{t(`methods.${method}.description`)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="pt-5">
          <Button type="submit" className="h-[45px] w-full rounded-xl" disabled={addFunds.isPending}>
            {addFunds.isPending ? "…" : t("submit")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}

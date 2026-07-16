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
import { useWithdraw } from "../hooks/use-finance";
import { withdrawSchema, type WithdrawInput } from "../schemas";
import type { FinancePaymentMethod } from "../types";

const METHOD_ICON: Record<FinancePaymentMethod, React.ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  BANK_TRANSFER: Landmark,
  MFS: Smartphone,
};
const METHODS: FinancePaymentMethod[] = ["CASH", "BANK_TRANSFER", "MFS"];

/** "Withdraw Funds" — Figma `1039:33295` (file `SCfMPdxP6vgW1uTxfqCtz7`). Mirrors `WithdrawDto`
 * exactly — unlike Add Funds, "Fund Name" is a real field here (`WithdrawDto.fundName`). No
 * `<Sheet>` wrapper — shares one with `WalletDialogContent`/`AddFundsDialogContent`, see that
 * file's doc comment for why. */
export function WithdrawDialogContent({ onBack }: { onBack: () => void }) {
  const t = useTranslations("finance.withdraw");
  const withdraw = useWithdraw();

  const form = useForm<WithdrawInput>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { paymentMethod: "CASH" },
  });

  async function onSubmit(values: WithdrawInput) {
    try {
      await withdraw.mutateAsync(values);
      toast.success(t("withdrawnToast"));
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
          <LabeledInput id="fundName" label={t("fundName")} placeholder={t("fundNamePlaceholder")} {...form.register("fundName")} error={form.formState.errors.fundName?.message} />
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
          <Button type="submit" className="h-[45px] w-full rounded-xl" disabled={withdraw.isPending}>
            {withdraw.isPending ? "…" : t("submit")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}

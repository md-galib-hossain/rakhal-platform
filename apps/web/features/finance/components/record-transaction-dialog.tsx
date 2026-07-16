"use client"; // multi-step wizard state + form

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Landmark, Receipt, TrendingUp, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { MoneyText } from "@/components/shared/money-text";
import { useLiabilities, useRecordTransaction } from "../hooks/use-finance";
import { recordTransactionFormSchema, TRANSACTION_TYPES, type RecordTransactionFormInput } from "../schemas";
import type { CreateTransactionPayload, FinanceCategory, FinanceTxnType } from "../types";

const TYPE_ICON: Record<FinanceTxnType, React.ComponentType<{ className?: string }>> = {
  OPERATING_EXPENSE: Receipt,
  INVENTORY_PURCHASE: Warehouse,
  REVENUE: TrendingUp,
  DEBT_LOAN: Landmark,
};

const TYPE_CATEGORY: Record<FinanceTxnType, FinanceCategory> = {
  OPERATING_EXPENSE: "OVERHEAD",
  INVENTORY_PURCHASE: "INVENTORY",
  REVENUE: "REVENUE",
  DEBT_LOAN: "DEBT",
};

const SUBTYPE_OPTIONS: Record<FinanceTxnType, string[]> = {
  OPERATING_EXPENSE: ["salary", "utilities", "maintenance", "other"],
  INVENTORY_PURCHASE: ["feed", "medicine", "equipment", "supplies", "other"],
  REVENUE: ["milk", "animal", "manure", "other"],
  DEBT_LOAN: ["new_loan", "emi_payment"],
};

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

function toPayload(values: RecordTransactionFormInput): CreateTransactionPayload {
  return {
    type: values.type,
    category: TYPE_CATEGORY[values.type],
    subType: values.subType,
    entityName: values.entityName || undefined,
    notes: values.notes || undefined,
    amount: values.amount,
    paymentType: values.type === "DEBT_LOAN" ? "FULL" : values.paymentType,
    paidNow: values.type === "DEBT_LOAN" ? undefined : values.paymentType === "PARTIAL" ? values.paidNow : undefined,
    dueDate: values.type === "DEBT_LOAN" ? undefined : values.paymentType === "PARTIAL" ? values.dueDate : undefined,
    paymentDate: values.paymentDate,
    cattleId: values.type === "REVENUE" && values.subType === "animal" ? values.cattleId : undefined,
    inventoryItemName: values.type === "INVENTORY_PURCHASE" ? values.inventoryItemName : undefined,
    quantity: values.type === "INVENTORY_PURCHASE" ? values.quantity : undefined,
    costPerUnit: values.type === "INVENTORY_PURCHASE" ? values.costPerUnit : undefined,
    monthlyEmi: values.type === "DEBT_LOAN" && values.subType === "new_loan" ? values.monthlyEmi : undefined,
    startDate: values.type === "DEBT_LOAN" && values.subType === "new_loan" ? values.startDate : undefined,
    durationMonths: values.type === "DEBT_LOAN" && values.subType === "new_loan" ? values.durationMonths : undefined,
    loanId: values.type === "DEBT_LOAN" && values.subType === "emi_payment" ? values.loanId : undefined,
  };
}

function StepProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((s) => (
        <div key={s} className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-primary-hover" : "bg-muted")} />
      ))}
    </div>
  );
}

/**
 * "Record" transaction wizard — Figma "What are you recording?" (`1039:25889`, Step 1) + "Expense
 * Details"/"Expense Summary" (`1039:31829` full-payment / `1039:32190` partial-payment /
 * `1039:32555` summary, file `SCfMPdxP6vgW1uTxfqCtz7`). Mirrors `CreateTransactionDto` — one DTO
 * covers all 4 types, the backend validates the type-specific fields it needs. **Only the Operating
 * Expense field set has a real Figma frame** (subType select labeled "Expense Category", Entity
 * Name, Amount, Full/Partial Payment tabs [+Pay Now/Remaining Balance/Due Date when Partial],
 * Payment Date, Notes) — reused verbatim for all 4 types below, with each type's own real
 * `CreateTransactionDto` fields substituted where Operating Expense has none: Inventory Purchase
 * adds Item Name/Quantity/Cost Per Unit (drives the real inventory auto-increment); Revenue adds a
 * `CattlePicker` only when "Animal" is picked as the sale type (drives the real "mark animal SOLD"
 * side effect); Debt/Loan swaps the Full/Partial tabs for its own real fields (Monthly EMI/Start
 * Date/Duration for a new loan, or a loan picker over `GET /finance/liabilities`'s active loans for
 * an EMI payment) since payment-type doesn't map meaningfully onto either loan flow. No Payment
 * Method field anywhere in this wizard — the real Figma frames don't show one either (`CreateTransactionDto.paymentMethod`
 * is left unset, the backend defaults it to `CASH`).
 */
export function RecordTransactionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <RecordTransactionDialogBody onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function RecordTransactionDialogBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("finance.record");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const recordTransaction = useRecordTransaction();
  const liabilities = useLiabilities();

  const form = useForm<RecordTransactionFormInput>({
    resolver: zodResolver(recordTransactionFormSchema),
    defaultValues: { paymentType: "FULL" },
  });
  const type = form.watch("type");
  const subType = form.watch("subType");
  const paymentType = form.watch("paymentType");
  const amount = form.watch("amount");
  const paidNow = form.watch("paidNow");

  async function goNext() {
    const fieldsToValidate: (keyof RecordTransactionFormInput)[] =
      step === 1 ? ["type"] : step === 2 ? ["subType", "amount", "paymentDate", "paymentType", "paidNow"] : [];
    const valid = await form.trigger(fieldsToValidate);
    if (valid) setStep((s) => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)));
  }

  async function onSubmit(values: RecordTransactionFormInput) {
    try {
      await recordTransaction.mutateAsync(toPayload(values));
      toast.success(t("createdToast"));
      form.reset({ paymentType: "FULL" });
      setStep(1);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const showPaymentTypeTabs = type !== "DEBT_LOAN";
  const activeLoans = liabilities.data?.loans.filter((l) => l.status === "ACTIVE") ?? [];

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[560px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[560px]"
    >
      <div className="flex items-start justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-4">
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">{t("stepOf", { step, total: 3 })}</p>
            <StepProgress step={step} />
          </div>

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-base font-medium text-foreground">{t("step1Title")}</p>
                <p className="text-xs text-muted-foreground">{t("step1Subtitle")}</p>
              </div>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <div className="flex flex-col gap-3">
                    {TRANSACTION_TYPES.map((value) => {
                      const Icon = TYPE_ICON[value];
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            field.onChange(value);
                            form.setValue("subType", "");
                          }}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                            field.value === value ? "border-primary bg-success-tint" : "border-border",
                          )}
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                            <Icon className="size-5" aria-hidden />
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{t(`types.${value}.label`)}</span>
                            <span className="text-xs text-muted-foreground">{t(`types.${value}.description`)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>
          ) : null}

          {step === 2 && type ? (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-base font-medium text-foreground">{t("step2Title")}</p>
                <p className="text-xs text-muted-foreground">{t(`step2Subtitle.${type}`)}</p>
              </div>

              <Controller
                control={form.control}
                name="subType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <LabeledSelectTrigger label={t(`subTypeLabel.${type}`)} placeholder={t("selectOption")} className="h-11" />
                    <SelectContent>
                      {SUBTYPE_OPTIONS[type].map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`subTypeOptions.${type}.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />

              {type !== "DEBT_LOAN" ? (
                <div className="flex gap-4">
                  <LabeledInput
                    id="entityName"
                    label={t(`entityNameLabel.${type}`)}
                    placeholder={t("entityNamePlaceholder")}
                    {...form.register("entityName")}
                  />
                  <LabeledInput
                    id="amount"
                    type="number"
                    step="0.01"
                    min={0}
                    label={t("amount")}
                    {...form.register("amount", numberField)}
                    error={form.formState.errors.amount?.message}
                  />
                </div>
              ) : subType === "new_loan" ? (
                <div className="flex gap-4">
                  <LabeledInput id="entityName" label={t("lenderName")} placeholder={t("entityNamePlaceholder")} {...form.register("entityName")} />
                  <LabeledInput
                    id="amount"
                    type="number"
                    step="0.01"
                    min={0}
                    label={t("loanAmount")}
                    {...form.register("amount", numberField)}
                    error={form.formState.errors.amount?.message}
                  />
                </div>
              ) : (
                <LabeledInput
                  id="amount"
                  type="number"
                  step="0.01"
                  min={0}
                  label={t("emiAmount")}
                  {...form.register("amount", numberField)}
                  error={form.formState.errors.amount?.message}
                />
              )}

              {type === "REVENUE" && subType === "animal" ? (
                <Controller
                  control={form.control}
                  name="cattleId"
                  render={({ field }) => (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs text-muted-foreground">{t("animal")}</p>
                      <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} placeholder={t("selectAnimal")} />
                    </div>
                  )}
                />
              ) : null}

              {type === "INVENTORY_PURCHASE" ? (
                <>
                  <LabeledInput id="inventoryItemName" label={t("itemName")} placeholder={t("itemNamePlaceholder")} {...form.register("inventoryItemName")} />
                  <div className="flex gap-4">
                    <LabeledInput id="quantity" type="number" step="0.01" min={0} label={t("quantity")} {...form.register("quantity", numberField)} />
                    <LabeledInput id="costPerUnit" type="number" step="0.01" min={0} label={t("costPerUnit")} {...form.register("costPerUnit", numberField)} />
                  </div>
                </>
              ) : null}

              {type === "DEBT_LOAN" && subType === "new_loan" ? (
                <div className="flex gap-4">
                  <LabeledInput id="monthlyEmi" type="number" step="0.01" min={0} label={t("monthlyEmi")} {...form.register("monthlyEmi", numberField)} />
                  <LabeledInput id="durationMonths" type="number" min={0} label={t("durationMonths")} {...form.register("durationMonths", numberField)} />
                </div>
              ) : null}
              {type === "DEBT_LOAN" && subType === "new_loan" ? (
                <Controller
                  control={form.control}
                  name="startDate"
                  render={({ field }) => <DatePicker label={t("startDate")} value={field.value} onChange={field.onChange} placeholder={t("selectDate")} />}
                />
              ) : null}

              {type === "DEBT_LOAN" && subType === "emi_payment" ? (
                <Controller
                  control={form.control}
                  name="loanId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <LabeledSelectTrigger label={t("selectLoan")} placeholder={t("selectOption")} className="h-11" />
                      <SelectContent>
                        {activeLoans.map((loan) => (
                          <SelectItem key={loan.id} value={loan.id}>
                            {loan.entityName} — <MoneyText amount={loan.outstanding} /> {t("outstandingSuffix")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : null}

              {showPaymentTypeTabs ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-foreground">{t("paymentType")}</p>
                  <Controller
                    control={form.control}
                    name="paymentType"
                    render={({ field }) => (
                      <div className="flex gap-2">
                        {(["FULL", "PARTIAL"] as const).map((pt) => (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => field.onChange(pt)}
                            className={cn(
                              "flex h-10 flex-1 items-center justify-center rounded-lg border bg-card px-4 py-1.5 text-sm font-bold transition-colors",
                              field.value === pt ? "border-primary text-primary" : "border-input text-muted-foreground",
                            )}
                          >
                            {t(`paymentTypeOptions.${pt}`)}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                  {paymentType === "PARTIAL" ? (
                    <div className="flex gap-4 pt-2">
                      <LabeledInput
                        id="paidNow"
                        type="number"
                        step="0.01"
                        min={0}
                        label={t("paidNow")}
                        {...form.register("paidNow", numberField)}
                        error={form.formState.errors.paidNow?.message}
                      />
                      <LabeledInput id="remainingBalance" label={t("remainingBalance")} value={Math.max(0, (amount || 0) - (paidNow || 0)).toFixed(2)} disabled readOnly />
                      <Controller
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => <DatePicker label={t("dueDate")} value={field.value} onChange={field.onChange} placeholder={t("selectDate")} />}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Controller
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <DatePicker
                    label={t("paymentDate")}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t("selectDate")}
                    error={form.formState.errors.paymentDate?.message}
                  />
                )}
              />

              <div>
                <Textarea id="notes" placeholder={t("notesPlaceholder")} className="h-20" {...form.register("notes")} />
                <label htmlFor="notes" className="mt-1 block text-xs text-muted-foreground">
                  {t("notes")}
                </label>
              </div>
            </div>
          ) : null}

          {step === 3 && type ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-base font-medium text-foreground">{t("step3Title")}</p>
                <p className="text-xs text-muted-foreground">{t("step3Subtitle")}</p>
              </div>
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <SummaryRow label={t(`subTypeLabel.${type}`)} value={t(`subTypeOptions.${type}.${subType}`)} />
                {form.getValues("entityName") ? <SummaryRow label={t(`entityNameLabel.${type}`)} value={form.getValues("entityName") ?? ""} /> : null}
                <SummaryRow label={t("amount")} value={<MoneyText amount={form.getValues("amount") ?? 0} />} />
                {type === "INVENTORY_PURCHASE" ? (
                  <>
                    <SummaryRow label={t("itemName")} value={form.getValues("inventoryItemName") || "—"} />
                    <SummaryRow label={t("quantity")} value={String(form.getValues("quantity") ?? "—")} />
                  </>
                ) : null}
                {showPaymentTypeTabs ? (
                  <>
                    <SummaryRow label={t("paymentType")} value={t(`paymentTypeOptions.${paymentType}`)} />
                    {paymentType === "PARTIAL" ? (
                      <>
                        <SummaryRow label={t("paidNow")} value={<MoneyText amount={paidNow ?? 0} />} />
                        <SummaryRow label={t("remainingBalance")} value={<MoneyText amount={Math.max(0, (amount || 0) - (paidNow || 0))} />} />
                        <SummaryRow label={t("dueDate")} value={form.getValues("dueDate") || "—"} />
                      </>
                    ) : null}
                  </>
                ) : null}
                {type === "DEBT_LOAN" && subType === "new_loan" ? (
                  <>
                    <SummaryRow label={t("monthlyEmi")} value={<MoneyText amount={form.getValues("monthlyEmi") ?? 0} />} />
                    <SummaryRow label={t("durationMonths")} value={String(form.getValues("durationMonths") ?? "—")} />
                  </>
                ) : null}
                <SummaryRow label={t("paymentDate")} value={form.getValues("paymentDate") || "—"} />
                {form.getValues("notes") ? <SummaryRow label={t("notes")} value={form.getValues("notes") ?? ""} /> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-2 pt-5">
          <Button
            type="button"
            variant="secondary"
            className="h-[52px] flex-1 rounded-xl"
            onClick={() => (step === 1 ? onOpenChange(false) : setStep((s) => ((s - 1) as 1 | 2 | 3)))}
            disabled={recordTransaction.isPending}
          >
            {step === 1 ? t("cancel") : t("back")}
          </Button>
          {step < 3 ? (
            <Button type="button" className="h-[52px] flex-1 rounded-xl" onClick={goNext} disabled={step === 1 && !type}>
              {t("continue")}
            </Button>
          ) : (
            <Button type="submit" className="h-[52px] flex-1 rounded-xl" disabled={recordTransaction.isPending}>
              {recordTransaction.isPending ? "…" : t("submit")}
            </Button>
          )}
        </div>
      </form>
    </SheetContent>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

"use client"; // multi-step wizard state + form

import { useEffect, useState } from "react";
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

// Inventory Purchase's Payment Method — defaulted to WALLET (see the type-select handler below) so
// the common case needs no extra click, per user request.
const PAYMENT_METHODS = ["WALLET", "CASH", "BANK_TRANSFER", "MFS"] as const;

/** Standard reducing-balance EMI formula. `annualRatePercent` is the client-only `interestRate`
 * field (no backend equivalent, see `schemas.ts`) — used only to drive this live display value. */
function computeMonthlyEmi(principal: number, annualRatePercent: number, months: number): number {
  if (!principal || !months) return 0;
  const r = annualRatePercent / 12 / 100;
  if (!r) return Math.round((principal / months) * 100) / 100;
  const factor = Math.pow(1 + r, months);
  return Math.round(((principal * r * factor) / (factor - 1)) * 100) / 100;
}

function toPayload(values: RecordTransactionFormInput): CreateTransactionPayload {
  const isRevenue = values.type === "REVENUE";
  return {
    type: values.type,
    category: TYPE_CATEGORY[values.type],
    subType: values.type === "INVENTORY_PURCHASE" ? undefined : values.subType,
    // Only Revenue's "Others" sub-type, Operating Expense, and Debt/Loan's "New Loan" (Lender Name,
    // Figma `1039:27393`) have a real Entity Name field — Milk/Animal/Manure and EMI Payment (no
    // lender field at all, `1039:28124`) never render that input.
    entityName:
      values.type === "INVENTORY_PURCHASE" ||
      (isRevenue && values.subType !== "other") ||
      (values.type === "DEBT_LOAN" && values.subType !== "new_loan")
        ? undefined
        : values.entityName || undefined,
    notes: values.notes || undefined,
    amount: values.amount,
    paymentType: values.type === "DEBT_LOAN" ? "FULL" : values.paymentType,
    paidNow: values.type === "DEBT_LOAN" ? undefined : values.paymentType === "PARTIAL" ? values.paidNow : undefined,
    dueDate: values.type === "DEBT_LOAN" ? undefined : values.paymentType === "PARTIAL" ? values.dueDate : undefined,
    // New Loan has no separate "Payment Date" field in Figma (`1039:27393`) — Start Date doubles as
    // the transaction's record date.
    paymentDate: values.type === "DEBT_LOAN" && values.subType === "new_loan" ? values.startDate : values.paymentDate,
    cattleId: isRevenue && values.subType === "animal" ? values.cattleId : undefined,
    litresSold: isRevenue && values.subType === "milk" ? values.litresSold : undefined,
    pricePerLitre: isRevenue && values.subType === "milk" ? values.pricePerLitre : undefined,
    inventoryItemName: values.type === "INVENTORY_PURCHASE" ? values.inventoryItemName : undefined,
    quantity: values.type === "INVENTORY_PURCHASE" ? values.quantity : undefined,
    costPerUnit: values.type === "INVENTORY_PURCHASE" ? values.costPerUnit : undefined,
    // Only Inventory Purchase gets a Payment Method — the only type with a real backend behavior
    // difference (wallet debit); other 3 types keep "unset → backend defaults to CASH".
    paymentMethod: values.type === "INVENTORY_PURCHASE" ? values.paymentMethod : undefined,
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
 * "Record" transaction wizard — Figma "What are you recording?" (`1039:25889`, Step 1) + Operating
 * Expense's "Expense Details"/"Expense Summary" (`1039:31829` full-payment / `1039:32190`
 * partial-payment / `1039:32555` summary) + Inventory Purchase's own real "Purchase Details"/
 * "Purchase Summary" (`1039:26265` step 1 reused / `1039:30721` full-payment / `1039:31083`
 * partial-payment / `1039:31449` summary) + Revenue/Sale's own real "Sale Details"/"Sale Summary"
 * (`1039:28862` Milk / `1039:29238` Animal / `1039:29613` Manure / `1039:29986` Others /
 * `1039:30360` summary) + Debt/Loan's own real "Debt Management"/summary frames (`1039:27017` Step 1
 * reused / `1039:27393` New Loan / `1039:28124` EMI Payment / `1039:27757` New Loan summary /
 * `1039:28505` EMI Payment summary, file `SCfMPdxP6vgW1uTxfqCtz7`). Mirrors `CreateTransactionDto` —
 * one DTO covers all 4 types, the backend validates the type-specific fields it needs. **All 4 types
 * now have real Figma frames.**
 *
 * Inventory Purchase's real field set, pixel-matched — **not** the same shape as Operating Expense:
 * Inventory Item (free text — `inventoryItemName`, no closed list exists to select from despite the
 * mock's decorative dropdown chevron), Quantity + Cost Per Unit side by side, a **read-only computed
 * Total Cost** (`quantity × costPerUnit`, submitted as `amount`), Full/Partial Payment tabs, a Date
 * field (labeled "Date", not "Payment Date"), Notes. **No Entity/Vendor Name field at all** for this
 * type (the mock's summary confirms it), so `entityName` stays unset for `INVENTORY_PURCHASE`.
 *
 * Revenue/Sale's real field set is the most structurally different of the four: "Sales Type" itself
 * is a real segmented **tab-pill bar** (Milk/Animal/Manure/Others), not a dropdown `Select` like
 * Operating Expense's "Expense Category" — and each of the 4 sub-types has a genuinely different data
 * field set below it, confirmed by pulling all 4 real Step-2 frames rather than guessing one shape
 * fits all: **Milk** — Liters Sold + Price Per Unit side by side, then a **read-only computed Total
 * Cost** (`litresSold × pricePerLitre`, submitted as `amount`, same "no typed Amount field" shape as
 * Inventory Purchase) — no Entity Name field at all. **Animal** — a `CattlePicker` (labeled "Select
 * Animal", drives the real "mark animal SOLD" side effect via `cattleId`) + a typed Amount — no
 * Entity Name field either. **Manure** — a typed Amount only, no other field. **Others** — Entity
 * Name + typed Amount, the only Revenue sub-type that has an entity field at all. Switching "Sales
 * Type" clears whichever of these fields the previous sub-type owned (`clearRevenueSubFields`) so a
 * stale value from one sub-type can never leak into another's submit payload.
 *
 * Debt/Loan's real field set (pixel-matched, replaces the previous no-frame extrapolation): "What
 * are you recording?" is real segmented tab-pills (New Loan/EMI Payment), same shape as Revenue's
 * Sales Type, not a dropdown. **New Loan** — Lender Name (full width), Principal Amount + Interest
 * Rate side by side, Tenure (months) + a **read-only computed Monthly EMI** side by side, Start Date,
 * Notes; no separate "Payment Date" field (Start Date doubles as the transaction's record date on
 * submit). **Real gap, flagged not faked**: `CreateTransactionDto`/`FinanceLoan` have no interest-rate
 * field at all — `interestRate` is a client-only form field (`schemas.ts`) used purely to drive the
 * live `computeMonthlyEmi` (standard reducing-balance formula) display value; never sent on submit.
 * **EMI Payment** — "Select Loan" is a real card list (not a dropdown) over `GET /finance/liabilities`'s
 * active loans, each showing the lender name, real "Remaining ৳X" (`outstanding`), and real "৳X/month"
 * (`monthlyEmi`) — the Figma mock also shows "X months left" per loan, dropped rather than fabricated
 * since `liabilities()` doesn't return `durationMonths`/`startDate` on the presented row, so there's no
 * real number to compute it from. Selecting a loan pre-fills EMI Amount from that loan's `monthlyEmi`
 * (editable after); EMI Amount + Payment Date + Notes complete the step, submitted as `amount`/
 * `paymentDate`/`loanId` against the real `applyEmiPayment` side effect. No Payment Method field for
 * Operating Expense/Revenue/Debt-Loan — the real Figma frames don't show one for any of them either
 * (`paymentMethod` left unset, the backend defaults it to `CASH`). **Exception**: Inventory Purchase
 * *does* get one (deliberate deviation from the Figma frame, user-requested) — it's the only type
 * with a real backend behavior difference (a `WALLET` selection debits the farm's wallet balance),
 * defaulted to `WALLET` so the common case needs no extra click.
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
  // Display-only — `cattleId` is what's actually submitted; kept alongside it purely for the Step 3
  // summary row's label (the `CattlePicker` only hands back a plain id via `form`).
  const [selectedCattleLabel, setSelectedCattleLabel] = useState("");
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
  const quantity = form.watch("quantity");
  const costPerUnit = form.watch("costPerUnit");
  const litresSold = form.watch("litresSold");
  const pricePerLitre = form.watch("pricePerLitre");
  const interestRate = form.watch("interestRate");
  const durationMonths = form.watch("durationMonths");
  const monthlyEmi = form.watch("monthlyEmi");
  const loanId = form.watch("loanId");

  // Inventory Purchase has no user-entered Amount field (Figma `1039:30721`/`1039:31083`) — Total
  // Cost is computed and submitted as `amount` instead.
  useEffect(() => {
    if (type !== "INVENTORY_PURCHASE") return;
    form.setValue("amount", Math.round((quantity || 0) * (costPerUnit || 0) * 100) / 100, { shouldValidate: false });
  }, [type, quantity, costPerUnit, form]);

  // Revenue's Milk sub-type has the same "no typed Amount field" shape (Figma `1039:28862`) — Total
  // Cost is computed from Liters Sold × Price Per Unit and submitted as `amount`.
  useEffect(() => {
    if (type !== "REVENUE" || subType !== "milk") return;
    form.setValue("amount", Math.round((litresSold || 0) * (pricePerLitre || 0) * 100) / 100, { shouldValidate: false });
  }, [type, subType, litresSold, pricePerLitre, form]);

  // Each Revenue sub-type owns a different, non-overlapping data field (Figma `1039:28862`/
  // `1039:29238`/`1039:29613`/`1039:29986`) — clear the others on switch so a stale value from a
  // previously-selected sub-type can never leak into the submitted payload.
  function selectRevenueSubType(next: string) {
    form.setValue("subType", next);
    form.setValue("entityName", "");
    form.setValue("cattleId", undefined);
    form.setValue("litresSold", undefined);
    form.setValue("pricePerLitre", undefined);
    form.setValue("amount", 0, { shouldValidate: false });
    setSelectedCattleLabel("");
  }

  // New Loan's Monthly EMI (Figma `1039:27393`) is a read-only computed value, same "Total Cost"
  // shape as Inventory Purchase/Revenue-Milk — not a typed field, since it's derived from Principal
  // Amount + the client-only Interest Rate + Tenure.
  useEffect(() => {
    if (type !== "DEBT_LOAN" || subType !== "new_loan") return;
    form.setValue("monthlyEmi", computeMonthlyEmi(amount || 0, interestRate || 0, durationMonths || 0), { shouldValidate: false });
  }, [type, subType, amount, interestRate, durationMonths, form]);

  // New Loan and EMI Payment own disjoint fields (Figma `1039:27393` vs `1039:28124`) — clear the
  // other sub-type's fields on switch, same precedent as `selectRevenueSubType`.
  function selectDebtLoanSubType(next: string) {
    form.setValue("subType", next);
    form.setValue("entityName", "");
    form.setValue("interestRate", undefined);
    form.setValue("monthlyEmi", undefined);
    form.setValue("durationMonths", undefined);
    form.setValue("startDate", undefined);
    form.setValue("loanId", undefined);
    form.setValue("amount", 0, { shouldValidate: false });
  }

  async function goNext() {
    const fieldsToValidate: (keyof RecordTransactionFormInput)[] =
      step === 1
        ? ["type"]
        : step === 2
          ? type === "DEBT_LOAN" && subType === "new_loan"
            ? ["subType", "entityName", "amount", "durationMonths", "startDate"]
            : type === "DEBT_LOAN" && subType === "emi_payment"
              ? ["subType", "loanId", "amount", "paymentDate"]
              : ["subType", "amount", "paymentDate", "paymentType", "paidNow"]
          : [];
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
                            if (value === "INVENTORY_PURCHASE") form.setValue("paymentMethod", "WALLET");
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
                <p className="text-base font-medium text-foreground">{type === "DEBT_LOAN" ? t("step2TitleDebtLoan") : t("step2Title")}</p>
                <p className="text-xs text-muted-foreground">{t(`step2Subtitle.${type}`)}</p>
              </div>

              {type === "OPERATING_EXPENSE" ? (
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
              ) : null}

              {type === "REVENUE" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-foreground">{t("subTypeLabel.REVENUE")}</p>
                  <div className="flex gap-2">
                    {SUBTYPE_OPTIONS.REVENUE.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => selectRevenueSubType(s)}
                        className={cn(
                          "flex h-10 flex-1 items-center justify-center rounded-lg border bg-card px-2 py-1.5 text-sm font-bold transition-colors",
                          subType === s ? "border-primary text-primary" : "border-input text-muted-foreground",
                        )}
                      >
                        {t(`subTypeOptions.REVENUE.${s}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {type === "DEBT_LOAN" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-foreground">{t("subTypeLabel.DEBT_LOAN")}</p>
                  <div className="flex gap-2">
                    {SUBTYPE_OPTIONS.DEBT_LOAN.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => selectDebtLoanSubType(s)}
                        className={cn(
                          "flex h-10 flex-1 items-center justify-center rounded-lg border bg-card px-2 py-1.5 text-sm font-bold transition-colors",
                          subType === s ? "border-primary text-primary" : "border-input text-muted-foreground",
                        )}
                      >
                        {t(`subTypeOptions.DEBT_LOAN.${s}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {type === "INVENTORY_PURCHASE" ? (
                <>
                  <LabeledInput id="inventoryItemName" label={t("itemName")} placeholder={t("itemNamePlaceholder")} {...form.register("inventoryItemName")} />
                  <div className="flex gap-4">
                    <LabeledInput id="quantity" type="number" step="0.01" min={0} label={t("quantity")} {...form.register("quantity", numberField)} />
                    <LabeledInput id="costPerUnit" type="number" step="0.01" min={0} label={t("costPerUnit")} {...form.register("costPerUnit", numberField)} />
                  </div>
                  <LabeledInput id="totalCost" label={t("totalCost")} value={((quantity || 0) * (costPerUnit || 0)).toFixed(2)} disabled readOnly />
                  <Controller
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <Select value={field.value ?? "WALLET"} onValueChange={field.onChange}>
                        <LabeledSelectTrigger label={t("paymentMethodLabel")} />
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {t(`paymentMethodOptions.${m}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </>
              ) : type === "REVENUE" && subType === "milk" ? (
                <>
                  <div className="flex gap-4">
                    <LabeledInput id="litresSold" type="number" step="0.01" min={0} label={t("litresSold")} {...form.register("litresSold", numberField)} />
                    <LabeledInput id="pricePerLitre" type="number" step="0.01" min={0} label={t("pricePerLitre")} {...form.register("pricePerLitre", numberField)} />
                  </div>
                  <LabeledInput id="totalCost" label={t("totalCost")} value={((litresSold || 0) * (pricePerLitre || 0)).toFixed(2)} disabled readOnly />
                </>
              ) : type === "REVENUE" && subType === "animal" ? (
                <Controller
                  control={form.control}
                  name="cattleId"
                  render={({ field }) => (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs text-muted-foreground">{t("selectAnimalLabel")}</p>
                      <CattlePicker
                        value={field.value}
                        onValueChange={(id, cattle) => {
                          field.onChange(id);
                          setSelectedCattleLabel(`${cattle.tagNumber}${cattle.name ? ` — ${cattle.name}` : ""}`);
                        }}
                        placeholder={t("selectAnimal")}
                      />
                    </div>
                  )}
                />
              ) : type === "REVENUE" && subType === "manure" ? null : type === "REVENUE" && subType === "other" ? (
                <LabeledInput
                  id="entityName"
                  label={t("entityNameLabel.REVENUE")}
                  placeholder={t("entityNamePlaceholder")}
                  {...form.register("entityName")}
                />
              ) : type === "REVENUE" || type === "DEBT_LOAN" ? null : (
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
              )}

              {type === "REVENUE" && (subType === "animal" || subType === "manure" || subType === "other") ? (
                <LabeledInput
                  id="amount"
                  type="number"
                  step="0.01"
                  min={0}
                  label={t("amount")}
                  {...form.register("amount", numberField)}
                  error={form.formState.errors.amount?.message}
                />
              ) : null}

              {type === "DEBT_LOAN" && subType === "new_loan" ? (
                <>
                  <LabeledInput id="entityName" label={t("lenderName")} placeholder={t("lenderNamePlaceholder")} {...form.register("entityName")} />
                  <div className="flex gap-4">
                    <LabeledInput
                      id="amount"
                      type="number"
                      step="0.01"
                      min={0}
                      label={t("principalAmount")}
                      {...form.register("amount", numberField)}
                      error={form.formState.errors.amount?.message}
                    />
                    <LabeledInput id="interestRate" type="number" step="0.01" min={0} max={100} label={t("interestRate")} {...form.register("interestRate", numberField)} />
                  </div>
                  <div className="flex gap-4">
                    <LabeledInput
                      id="durationMonths"
                      type="number"
                      min={0}
                      label={t("tenureMonths")}
                      {...form.register("durationMonths", numberField)}
                      error={form.formState.errors.durationMonths?.message}
                    />
                    <LabeledInput id="monthlyEmi" label={t("monthlyEmi")} value={(monthlyEmi ?? 0).toFixed(2)} disabled readOnly />
                  </div>
                  <Controller
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <DatePicker
                        label={t("startDate")}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t("selectDate")}
                        error={form.formState.errors.startDate?.message}
                      />
                    )}
                  />
                </>
              ) : null}

              {type === "DEBT_LOAN" && subType === "emi_payment" ? (
                <>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-foreground">{t("selectLoan")}</p>
                    <Controller
                      control={form.control}
                      name="loanId"
                      render={({ field }) => (
                        <div className="flex flex-col gap-2">
                          {activeLoans.map((loan) => (
                            <button
                              key={loan.id}
                              type="button"
                              onClick={() => {
                                field.onChange(loan.id);
                                form.setValue("amount", loan.monthlyEmi, { shouldValidate: false });
                              }}
                              className={cn(
                                "flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors",
                                field.value === loan.id ? "border-primary" : "border-border",
                              )}
                            >
                              <span className="flex flex-col gap-1">
                                <span className="text-base font-bold text-foreground">{loan.entityName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {t("remainingPrefix")} <MoneyText amount={loan.outstanding} />
                                </span>
                              </span>
                              <span className="whitespace-nowrap text-right">
                                <span className="text-base font-bold text-foreground">
                                  <MoneyText amount={loan.monthlyEmi} />
                                </span>
                                <span className="text-sm text-muted-foreground">{t("perMonthSuffix")}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    />
                  </div>
                  <LabeledInput
                    id="amount"
                    type="number"
                    step="0.01"
                    min={0}
                    label={t("emiAmount")}
                    {...form.register("amount", numberField)}
                    error={form.formState.errors.amount?.message}
                  />
                </>
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

              {/* New Loan has no separate "Payment Date" field (Figma `1039:27393`) — Start Date above
                  already covers it; showing both would be a field Figma never draws. */}
              {!(type === "DEBT_LOAN" && subType === "new_loan") ? (
                <Controller
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <DatePicker
                      label={t(type === "INVENTORY_PURCHASE" || type === "REVENUE" ? "dateShort" : "paymentDate")}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t("selectDate")}
                      error={form.formState.errors.paymentDate?.message}
                    />
                  )}
                />
              ) : null}

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
                <p className="text-base font-medium text-foreground">
                  {type === "DEBT_LOAN" ? t(`step3TitleDebtLoan.${subType}`) : t("step3Title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {type === "DEBT_LOAN" ? t(`step3SubtitleDebtLoan.${subType}`) : t("step3Subtitle")}
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                {type === "INVENTORY_PURCHASE" ? (
                  <>
                    <SummaryRow label={t("itemName")} value={form.getValues("inventoryItemName") || "—"} />
                    <SummaryRow label={t("quantity")} value={String(form.getValues("quantity") ?? "—")} />
                    <SummaryRow label={t("costPerUnit")} value={<MoneyText amount={costPerUnit ?? 0} />} />
                    <SummaryRow label={t("totalCost")} value={<MoneyText amount={form.getValues("amount") ?? 0} />} />
                  </>
                ) : type === "REVENUE" ? (
                  <>
                    <SummaryRow label={t("subTypeLabel.REVENUE")} value={t(`subTypeOptions.REVENUE.${subType}`)} />
                    {subType === "milk" ? (
                      <>
                        <SummaryRow label={t("litresSold")} value={String(form.getValues("litresSold") ?? "—")} />
                        <SummaryRow label={t("pricePerLitre")} value={<MoneyText amount={pricePerLitre ?? 0} />} />
                        <SummaryRow label={t("totalCost")} value={<MoneyText amount={form.getValues("amount") ?? 0} />} />
                      </>
                    ) : subType === "animal" ? (
                      <>
                        <SummaryRow label={t("selectAnimalLabel")} value={selectedCattleLabel || "—"} />
                        <SummaryRow label={t("amount")} value={<MoneyText amount={form.getValues("amount") ?? 0} />} />
                      </>
                    ) : subType === "other" ? (
                      <>
                        <SummaryRow label={t("entityNameLabel.REVENUE")} value={form.getValues("entityName") || "—"} />
                        <SummaryRow label={t("amount")} value={<MoneyText amount={form.getValues("amount") ?? 0} />} />
                      </>
                    ) : (
                      <SummaryRow label={t("amount")} value={<MoneyText amount={form.getValues("amount") ?? 0} />} />
                    )}
                  </>
                ) : type === "DEBT_LOAN" && subType === "new_loan" ? (
                  <>
                    <SummaryRow label={t("lenderName")} value={form.getValues("entityName") || "—"} />
                    <SummaryRow label={t("principalAmount")} value={<MoneyText amount={form.getValues("amount") ?? 0} />} />
                    <SummaryRow label={t("interestRate")} value={`${interestRate ?? 0}%`} />
                    <SummaryRow label={t("tenureMonths")} value={String(durationMonths ?? "—")} />
                    <SummaryRow label={t("monthlyEmi")} value={<MoneyText amount={monthlyEmi ?? 0} />} />
                    <SummaryRow label={t("startDate")} value={form.getValues("startDate") || "—"} />
                  </>
                ) : type === "DEBT_LOAN" && subType === "emi_payment" ? (
                  <>
                    <SummaryRow label={t("loanName")} value={activeLoans.find((l) => l.id === loanId)?.entityName || "—"} />
                    <SummaryRow label={t("emiAmount")} value={<MoneyText amount={form.getValues("amount") ?? 0} />} />
                    <SummaryRow label={t("paymentDate")} value={form.getValues("paymentDate") || "—"} />
                  </>
                ) : (
                  <>
                    <SummaryRow label={t(`subTypeLabel.${type}`)} value={t(`subTypeOptions.${type}.${subType}`)} />
                    {form.getValues("entityName") ? <SummaryRow label={t(`entityNameLabel.${type}`)} value={form.getValues("entityName") ?? ""} /> : null}
                    <SummaryRow label={t("amount")} value={<MoneyText amount={form.getValues("amount") ?? 0} />} />
                  </>
                )}
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
                {type !== "DEBT_LOAN" ? <SummaryRow label={t("paymentDate")} value={form.getValues("paymentDate") || "—"} /> : null}
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

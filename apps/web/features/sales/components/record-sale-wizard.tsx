"use client"; // wizard state + per-sale-type submit

import { todayLocalIso } from "@/lib/local-date";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Landmark, PackageSearch, TrendingUp, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@rakhal/ui/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@rakhal/ui/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@rakhal/ui/ui/select";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { MoneyText } from "@/components/shared/money-text";
import { MoneyInput } from "@/components/shared/money-input";
import { Wizard, type WizardStep } from "@/components/shared/wizard";
import { AccountPicker } from "@/features/finance/components/account-picker";
import { ItemPicker } from "@/features/purchasing/components/item-picker";
import { PAYMENT_METHODS } from "@/lib/types/payment";
import { clampAmountReceived, computeDue, computeLineTotal } from "../domain/sale-math";
import { recordSaleFormSchema, type RecordSaleFormInput } from "../schemas";
import { PRODUCT_SALE_SUBTYPES, RECORD_SALE_TYPES, type ProductSaleSubtype, type RecordSaleInitial, type RecordSaleType } from "../types";
import type { PurchasableItemOption } from "@/features/purchasing/types";
import { useIncomeCategories, useRecordOtherIncome, useSellAnimal, useSellInventory, useSellManure } from "../hooks/use-sales";

function today(): string {
  return todayLocalIso();
}

/** Same `setValueAs` adapter `record-transaction-dialog.tsx`'s own `numberField` uses — a plain
 * `register()`'d `<input type="number">` hands back a string otherwise, which would silently
 * break both this file's own `saleTotal`/`due` math (string concatenation, not addition) and the
 * real request payloads (`class-validator`'s `@IsNumber()` rejects a JSON string). */
const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

const TYPE_ICON: Record<RecordSaleType, React.ComponentType<{ className?: string }>> = {
  PRODUCT: TrendingUp,
  ANIMAL: Landmark,
  OTHER_INCOME: PackageSearch,
};

const PRODUCT_ICON: Record<ProductSaleSubtype, React.ComponentType<{ className?: string }>> = {
  MANURE: Wheat,
  INVENTORY: PackageSearch,
};

/**
 * `RecordSaleWizard` (RAKHAL-357, Finance V2 — `FINANCE_V2_DESIGN.md` §4.6). Replaces V1's
 * `Milk | Animal | Manure | Others` tab-pills (`record-transaction-dialog.tsx:368-388`) with the
 * ticket's own "Product Sale / Animal Sale / Other Income" framing, built on RAKHAL-355's generic
 * `Wizard` (form-library-agnostic `onValidateStep`, not bound to one `useForm` instance — exactly
 * the shape its own doc comment says this ticket would need, since the field set genuinely differs
 * per sale type/sub-type the way V1's did, not a cosmetic reskin).
 *
 * **Which sale types are actually live — confirmed against the running backend source, not
 * assumed from the design doc's model list** (full reasoning: `types.ts`'s top doc comment):
 *
 * | Type | Route | Status |
 * |---|---|---|
 * | Other Income | `POST /finance/income` (RAKHAL-350) | **wired** |
 * | Product Sale → Manure | `POST /sales/manure` (RAKHAL-347/376) | **wired** |
 * | Product Sale → Inventory item | `POST /sales/inventory` (RAKHAL-346/376) | **wired** |
 * | Animal Sale | `SellAnimalUseCase` (RAKHAL-345) | **wired** — `POST /sales/animal/:cattleId` (RAKHAL-399) |
 *
 * RAKHAL-388 (MILESTONE 22): all 5 combinations are now real routes — the old `isSaleFlowWired`
 * per-type gate and its "not available yet" submit block are deleted. Inventory item selection
 * uses `ItemPicker` (reused from `features/purchasing/**`, same Medicine/FeedItem/Equipment
 * search-select `PurchaseLine` already uses); Manure takes a single `Total Amount` figure
 * (`SellManureDto` has no quantity×unitPrice derivation server-side — RD-058, no manure
 * production/stock model).
 *
 * **Sale Total / Due derivation** (this ticket's other core deliverable, `FINANCE_V2_DESIGN.md`
 * §4.6): the wizard never asks "Full or Partial?" — it asks "Amount Received" and computes Due
 * (`domain/sale-math.ts#computeDue`), pure functions covered by `sale-math.test.ts`.
 *
 * **Milk is not sold here any more.** Selling milk has its own one-screen `SellMilkSheet`
 * (`sell-milk-sheet.tsx`): a milk sale is just buyer + litres + paid-now/credit, and
 * `POST /milk/dispatch` takes the payment in the same atomic call. This wizard used to drive milk
 * through a 3-call chain (dispatch, payment, allocation) that could silently drop the payment.
 */
/** `initial` (RAKHAL-361) pre-selects Step 1 — Cattle profile "Sell" passes `{type:"ANIMAL",
 * cattleId, cattleLabel}`, an Inventory item's "Sell" passes `{type:"PRODUCT", productSubtype:"INVENTORY"}`. The wizard
 * still opens on Step 1 (never auto-advances) so the farmer can confirm/change the pre-fill; only
 * the initial selection is seeded. */
export function RecordSaleDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: RecordSaleInitial;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <RecordSaleWizardBody onClose={() => onOpenChange(false)} initial={initial} /> : null}
    </Sheet>
  );
}

function RecordSaleWizardBody({ onClose, initial }: { onClose: () => void; initial?: RecordSaleInitial }) {
  const t = useTranslations("sales.record");
  const [step, setStep] = useState(0);
  const [selectedCattleLabel, setSelectedCattleLabel] = useState(initial?.cattleLabel ?? "");
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RecordSaleFormInput>({
    resolver: zodResolver(recordSaleFormSchema),
    defaultValues: {
      saleDate: today(),
      type: initial?.type,
      productSubtype: initial?.productSubtype,
      cattleId: initial?.cattleId,
      description: initial?.description,
    },
  });
  const type = form.watch("type");
  const productSubtype = form.watch("productSubtype");
  const quantity = form.watch("quantity");
  const unitPrice = form.watch("unitPrice");
  const salePrice = form.watch("salePrice");
  const amount = form.watch("amount");
  const amountReceived = form.watch("amountReceived");

  const incomeCategories = useIncomeCategories(type === "OTHER_INCOME");
  const recordOtherIncome = useRecordOtherIncome();
  const sellAnimal = useSellAnimal();
  const sellInventory = useSellInventory();
  const sellManure = useSellManure();

  /** Sale Total — not "Total Cost" (this ticket's own AC, see `sale-math.ts`'s doc comment).
   * Every type computes exactly what it will submit. */
  const saleTotal =
    type === "PRODUCT" && productSubtype === "INVENTORY"
      ? computeLineTotal(quantity, unitPrice)
      : type === "PRODUCT" && productSubtype === "MANURE"
        ? (amount ?? 0)
        : type === "ANIMAL"
          ? (salePrice ?? 0)
          : (amount ?? 0);

  const due = computeDue(saleTotal, amountReceived);
  const needsPaymentMethod = type !== "OTHER_INCOME";

  function selectType(next: RecordSaleType) {
    form.reset({ type: next, saleDate: form.getValues("saleDate") || today() });
    setSelectedCattleLabel("");
  }

  function selectProductSubtype(next: ProductSaleSubtype) {
    form.setValue("productSubtype", next);
    form.setValue("quantity", undefined);
    form.setValue("unitPrice", undefined);
    form.setValue("itemKind", undefined);
    form.setValue("itemId", "");
    form.setValue("itemName", "");
    form.setValue("amount", undefined);
  }

  async function validateStep(fields: (keyof RecordSaleFormInput)[] | undefined, stepIndex: number) {
    if (stepIndex === 0 && !type) {
      toast.error(t("selectTypeFirst"));
      return false;
    }
    if (stepIndex === 0 && type === "PRODUCT" && !productSubtype) {
      toast.error(t("selectProductFirst"));
      return false;
    }
    const valid = await form.trigger(fields ?? []);
    if (!valid) return false;
    if (stepIndex === 0 && type === "PRODUCT" && productSubtype === "INVENTORY" && !form.getValues("itemId")) {
      toast.error(t("selectItemFirst"));
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const values = form.getValues();
      if (values.type === "PRODUCT" && values.productSubtype === "INVENTORY") {
        const result = await sellInventory.mutateAsync({
          itemType: values.itemKind as "MEDICINE" | "FEED_ITEM" | "EQUIPMENT",
          itemId: values.itemId as string,
          quantity: values.quantity as number,
          unitPrice: values.unitPrice as number,
          notes: values.notes || undefined,
          saleDate: values.saleDate,
          financialAccountId: values.financialAccountId || undefined,
          paymentMethod: values.paymentMethod || undefined,
          amountReceived: values.amountReceived || undefined,
        });
        toast.success(t("createdToast", { amount: result.sale.totalAmount }));
      } else if (values.type === "PRODUCT" && values.productSubtype === "MANURE") {
        const result = await sellManure.mutateAsync({
          totalAmount: values.amount as number,
          notes: values.notes || undefined,
          saleDate: values.saleDate,
          financialAccountId: values.financialAccountId || undefined,
          paymentMethod: values.paymentMethod || undefined,
          amountReceived: values.amountReceived || undefined,
        });
        toast.success(t("createdToast", { amount: result.sale.totalAmount }));
      } else if (values.type === "ANIMAL") {
        const result = await sellAnimal.mutateAsync({
          cattleId: values.cattleId as string,
          dto: {
            salePrice: values.salePrice as number,
            saleDate: values.saleDate,
            financialAccountId: values.financialAccountId || undefined,
            paymentMethod: values.paymentMethod || undefined,
            amountReceived: values.amountReceived || undefined,
          },
        });
        toast.success(t("createdToast", { amount: result.totalAmount }));
      } else if (values.type === "OTHER_INCOME") {
        await recordOtherIncome.mutateAsync({
          categoryId: values.categoryId as string,
          description: values.description || undefined,
          amount: values.amount as number,
          date: values.saleDate,
          financialAccountId: values.financialAccountId as string,
        });
        toast.success(t("createdToast", { amount: values.amount ?? 0 }));
      }
      form.reset({ saleDate: today() });
      setStep(0);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  const steps: WizardStep<keyof RecordSaleFormInput>[] = [
    {
      key: "type",
      title: t("step1Title"),
      subtitle: t("step1Subtitle"),
      fields:
        type === "PRODUCT" && productSubtype === "INVENTORY"
          ? ["quantity", "unitPrice", "saleDate"]
          : type === "PRODUCT" && productSubtype === "MANURE"
            ? ["amount", "saleDate"]
            : type === "ANIMAL"
              ? ["cattleId", "salePrice", "saleDate"]
              : type === "OTHER_INCOME"
                ? ["categoryId", "amount", "saleDate"]
                : [],
      content: (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {RECORD_SALE_TYPES.map((value) => {
              const Icon = TYPE_ICON[value];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectType(value)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    type === value ? "border-primary bg-success-tint" : "border-border",
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

          {type === "PRODUCT" ? (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-foreground">{t("productSubtype")}</p>
                <div className="flex gap-2">
                  {PRODUCT_SALE_SUBTYPES.map((s) => {
                    const Icon = PRODUCT_ICON[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => selectProductSubtype(s)}
                        className={cn(
                          "flex h-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg border bg-card px-2 py-1.5 text-xs font-bold transition-colors",
                          productSubtype === s ? "border-primary text-primary" : "border-input text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                        {t(`productSubtypeOptions.${s}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {productSubtype === "INVENTORY" ? (
                <>
                  <Controller
                    control={form.control}
                    name="itemKind"
                    render={() => (
                      <ItemPicker
                        kind={(form.watch("itemKind") as "MEDICINE" | "FEED_ITEM" | "EQUIPMENT") ?? "MEDICINE"}
                        onKindChange={(kind) => {
                          form.setValue("itemKind", kind);
                          form.setValue("itemId", "");
                          form.setValue("itemName", "");
                        }}
                        value={
                          form.watch("itemId")
                            ? ({ id: form.watch("itemId"), name: form.watch("itemName"), currentStock: 0, unitSymbol: "" } as PurchasableItemOption)
                            : null
                        }
                        onChange={(item) => {
                          form.setValue("itemId", item?.id ?? "");
                          form.setValue("itemName", item?.name ?? "");
                        }}
                      />
                    )}
                  />
                  <div className="flex gap-4">
                    <LabeledInput id="quantity" type="number" step="0.01" min={0} label={t("quantity")} {...form.register("quantity", numberField)} />
                    <LabeledInput id="unitPrice" type="number" step="0.01" min={0} label={t("unitPrice")} {...form.register("unitPrice", numberField)} />
                  </div>
                  <LabeledInput id="saleTotalPreview" label={t("saleTotal")} value={saleTotal.toFixed(2)} disabled readOnly />
                </>
              ) : productSubtype === "MANURE" ? (
                <LabeledInput
                  id="amount"
                  type="number"
                  step="0.01"
                  min={0}
                  label={t("manureTotalAmount")}
                  error={form.formState.errors.amount?.message}
                  {...form.register("amount", numberField)}
                />
              ) : null}
            </>
          ) : null}

          {type === "ANIMAL" ? (
            <>
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
              <LabeledInput id="salePrice" type="number" step="0.01" min={0} label={t("salePrice")} error={form.formState.errors.salePrice?.message} {...form.register("salePrice", numberField)} />
            </>
          ) : null}

          {type === "OTHER_INCOME" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">{t("incomeCategory")}</p>
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <LabeledSelectTrigger label={t("incomeCategory")} placeholder={t("selectOption")} />
                      <SelectContent>
                        {(incomeCategories.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <LabeledInput id="description" label={t("description")} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />
              <LabeledInput id="amount" type="number" step="0.01" min={0} label={t("amount")} error={form.formState.errors.amount?.message} {...form.register("amount", numberField)} />
            </>
          ) : null}

          {type ? (
            <Controller
              control={form.control}
              name="saleDate"
              render={({ field }) => (
                <DatePicker label={t("saleDate")} value={field.value} onChange={field.onChange} placeholder={t("selectDate")} error={form.formState.errors.saleDate?.message} />
              )}
            />
          ) : null}

          {type ? (
            <div>
              <Textarea id="notes" placeholder={t("notesPlaceholder")} className="h-16" {...form.register("notes")} />
              <label htmlFor="notes" className="mt-1 block text-xs text-muted-foreground">
                {t("notes")}
              </label>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "payment",
      title: t("step2Title"),
      subtitle: type === "OTHER_INCOME" ? t("step2SubtitleOtherIncome") : t("step2Subtitle"),
      fields: ["financialAccountId", ...(needsPaymentMethod ? (["paymentMethod"] as const) : [])],
      content: (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border p-3">
            <SummaryRow label={t("saleTotal")} value={<MoneyText amount={saleTotal} />} />
          </div>
          <Controller
            control={form.control}
            name="financialAccountId"
            render={({ field }) => (
              <AccountPicker value={field.value} onChange={field.onChange} error={form.formState.errors.financialAccountId?.message} />
            )}
          />
          {type === "OTHER_INCOME" ? (
            <p className="text-xs text-muted-foreground">{t("otherIncomePaidInFull")}</p>
          ) : (
            <>
              <Controller
                control={form.control}
                name="amountReceived"
                render={({ field }) => (
                  <MoneyInput
                    id="amountReceived"
                    label={t("amountReceived")}
                    value={field.value}
                    onChange={(v) => field.onChange(clampAmountReceived(v, saleTotal))}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <LabeledInput id="due" label={t("due")} value={due.toFixed(2)} disabled readOnly />
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">{t("paymentMethod")}</p>
                <Controller
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <LabeledSelectTrigger label={t("paymentMethod")} placeholder={t("selectOption")} />
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
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      key: "review",
      title: t("step3Title"),
      subtitle: t("step3Subtitle"),
      content: (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <SummaryRow label={t("types.PRODUCT.label")} value={type ? t(`types.${type}.label`) : "—"} />
            {type === "PRODUCT" ? (
              <SummaryRow label={t("quantity")} value={String(quantity ?? "—")} />
            ) : type === "ANIMAL" ? (
              <SummaryRow label={t("selectAnimalLabel")} value={selectedCattleLabel || "—"} />
            ) : null}
            <SummaryRow label={t("saleTotal")} value={<MoneyText amount={saleTotal} />} />
            {type !== "OTHER_INCOME" ? (
              <>
                <SummaryRow label={t("amountReceived")} value={<MoneyText amount={amountReceived ?? 0} />} />
                <SummaryRow label={t("due")} value={<MoneyText amount={due} />} />
              </>
            ) : null}
          </div>
        </div>
      ),
    },
  ];

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[560px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[560px]"
    >
      <div className="flex items-start justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
      </div>
      <div className="border-t border-dashed border-border" />
      <div className="flex min-h-0 flex-1 flex-col py-4">
        <Wizard
          steps={steps}
          step={step}
          onStepChange={setStep}
          onValidateStep={validateStep}
          onSubmit={handleSubmit}
          onCancel={onClose}
          submitting={submitting}
          submitLabel={t("submit")}
          cancelLabel={t("cancel")}
          backLabel={t("back")}
          nextLabel={t("continue")}
          stepOfLabel={(s, total) => t("stepOf", { step: s, total })}
        />
      </div>
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

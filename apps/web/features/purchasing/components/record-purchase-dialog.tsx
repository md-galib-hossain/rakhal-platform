"use client"; // form state + line-item field array + mutation

import { todayLocalIso } from "@/lib/local-date";
import { Controller, useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MoneyInput } from "@/components/shared/money-input";
import { AccountPicker } from "@/features/finance/components/account-picker";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { ItemPicker } from "./item-picker";
import { SupplierPicker } from "./supplier-picker";
import { useCreatePurchase } from "../hooks/use-purchasing";
import { computePurchaseOutstanding, computePurchaseTotal, purchaseFormSchema, type PurchaseFormInput } from "../schemas";
import type { CreatePurchasePayload, PurchasableItemOption } from "../types";

function toPayload(values: PurchaseFormInput): CreatePurchasePayload {
  return {
    supplierId: values.supplierId,
    purchaseDate: values.purchaseDate,
    notes: values.notes?.trim() || undefined,
    lines: values.lines.map((line) => ({
      medicineId: line.itemKind === "MEDICINE" ? line.itemId : undefined,
      feedItemId: line.itemKind === "FEED_ITEM" ? line.itemId : undefined,
      equipmentId: line.itemKind === "EQUIPMENT" ? line.itemId : undefined,
      quantity: line.quantity,
      unitCost: line.unitCost,
    })),
    paidAmount: values.paidNow ? values.paidAmount : undefined,
    financialAccountId: values.paidNow ? values.financialAccountId : undefined,
    dueDate: !values.paidNow || (values.paidAmount ?? 0) < computePurchaseTotal(values.lines) ? values.dueDate : undefined,
  };
}

const EMPTY_LINE = { itemKind: "MEDICINE" as const, itemId: "", itemName: "", quantity: 1, unitCost: 0 };

/**
 * Record Purchase — a standalone flow, deliberately separate from Record Expense. A purchase always
 * **increases inventory stock** (Medicine/FeedItem/Equipment) — the primary test scenario mirrors
 * the backend's own worked AC example (`FINANCE_V2_DESIGN.md` §5.1, `CreatePurchaseDto`'s doc
 * comment): "৳30,000 feed purchase, ৳20,000 paid from Bank → Payable 10,000, inventory +quantity".
 * Posts to `POST /purchasing/purchases` (RAKHAL-348, live) — one atomic transaction server-side:
 * document + lines + real stock increment + journal + (if not fully paid) a `Payable`.
 *
 * **Supplier is now a required `SupplierPicker`** (RAKHAL-391, MILESTONE 22) — RAKHAL-365 promoted
 * `Purchase.supplierId` to a real `Supplier` FK, and `BUSINESS_IA_PRD.md` §5.13's field table marks
 * it required in this modal (stricter than the DTO, which stays optional server-side for a walk-up
 * cash purchase). The stale RAKHAL-359 free-text field this doc comment used to describe is gone.
 *
 * Unlike Record Expense, payment here can be **partial** — `paidAmount` is a free amount up to the
 * computed total (not an implicit "full amount" flag), matching `CreatePurchaseDto.paidAmount`'s own
 * doc comment on why it's a DTO-only field, not a stored column.
 */
export function RecordPurchaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? <RecordPurchaseDialogBody onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function RecordPurchaseDialogBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("purchasing.recordPurchase");
  const locale = useLocale() as Locale;
  const createPurchase = useCreatePurchase();

  const form = useForm<PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      purchaseDate: todayLocalIso(),
      lines: [EMPTY_LINE],
      paidNow: true,
      paidAmount: 0,
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = form.watch("lines");
  const paidNow = form.watch("paidNow");
  const paidAmount = form.watch("paidAmount") ?? 0;

  const total = computePurchaseTotal(lines.map((l) => ({ quantity: l.quantity || 0, unitCost: l.unitCost || 0 })));
  const outstanding = computePurchaseOutstanding(total, paidNow ? paidAmount : 0);

  async function onSubmit(values: PurchaseFormInput) {
    if (values.paidNow && (values.paidAmount ?? 0) > computePurchaseTotal(values.lines)) {
      form.setError("paidAmount", { message: t("paidAmountExceedsTotal") });
      return;
    }
    try {
      const purchase = await createPurchase.mutateAsync(toPayload(values));
      toast.success(t("createdToast", { number: purchase.purchaseNumber }));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[680px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[680px]"
    >
      <div className="flex items-center justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        <button type="button" onClick={() => onOpenChange(false)} aria-label={t("close")} className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70">
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="supplierId"
              render={({ field, fieldState }) => (
                <SupplierPicker value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={form.control}
              name="purchaseDate"
              render={({ field, fieldState }) => (
                <DatePicker id="purchaseDate" label={t("purchaseDate")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} disabledDates={{ after: new Date() }} />
              )}
            />
          </div>

          <div className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">{t("lines")}</div>
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <PurchaseLineRow
                key={field.id}
                index={index}
                form={form}
                lineTotal={(lines[index]?.quantity || 0) * (lines[index]?.unitCost || 0)}
                onRemove={() => remove(index)}
                removeDisabled={fields.length === 1}
                t={t}
                locale={locale}
              />
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY_LINE)} className="self-start">
              <Plus className="mr-1 size-4" aria-hidden />
              {t("addLine")}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
            <span className="text-sm font-medium text-foreground">{t("purchaseTotal")}</span>
            <span className="text-base font-bold text-foreground">{formatMoney(total, locale)}</span>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("paymentType")}</Label>
            <Controller
              control={form.control}
              name="paidNow"
              render={({ field }) => (
                <RadioGroup
                  value={field.value ? "PAID_NOW" : "BUY_ON_CREDIT"}
                  onValueChange={(v) => field.onChange(v === "PAID_NOW")}
                  className="grid grid-cols-2 gap-3"
                >
                  <label className="flex items-center gap-2 rounded-xl border border-input bg-card px-4 py-3 text-sm font-medium text-foreground">
                    <RadioGroupItem value="PAID_NOW" id="payment-type-paid-now" />
                    {t("payNow")}
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-input bg-card px-4 py-3 text-sm font-medium text-foreground">
                    <RadioGroupItem value="BUY_ON_CREDIT" id="payment-type-credit" />
                    {t("buyOnCredit")}
                  </label>
                </RadioGroup>
              )}
            />
          </div>

          {paidNow ? (
            <>
              <Controller
                control={form.control}
                name="paidAmount"
                render={({ field, fieldState }) => (
                  <MoneyInput id="paidAmount" label={t("amountPaid")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
                )}
              />
              <Controller
                control={form.control}
                name="financialAccountId"
                render={({ field, fieldState }) => (
                  <AccountPicker value={field.value} onChange={field.onChange} error={fieldState.error?.message} placeholder={t("payFromAccount")} />
                )}
              />
            </>
          ) : null}

          {outstanding > 0 ? (
            <>
              <div className="flex items-center justify-between rounded-xl bg-warning-tint px-4 py-3">
                <span className="text-sm font-medium text-warning">{t("payableRaised")}</span>
                <span className="text-base font-bold text-warning">{formatMoney(outstanding, locale)}</span>
              </div>
              <Controller
                control={form.control}
                name="dueDate"
                render={({ field, fieldState }) => (
                  <DatePicker id="dueDate" label={t("dueDateOptional")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
                )}
              />
            </>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea id="notes" {...form.register("notes")} />
          </div>
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={createPurchase.isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={createPurchase.isPending}>
            {createPurchase.isPending ? "…" : t("record")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}

/** One `PurchaseLine` row — item picker (kind + search-select) + quantity + unit cost + live line
 * total. Split out from the parent body so each row only re-renders on its own field changes, not
 * the whole line array (`useFieldArray` re-renders every row on any array mutation regardless, but
 * keeping this as its own component keeps the JSX legible and avoids nesting one `Controller`
 * inside another, which `ItemPicker`'s combined kind+value contract doesn't need). */
function PurchaseLineRow({
  index,
  form,
  lineTotal,
  onRemove,
  removeDisabled,
  t,
  locale,
}: {
  index: number;
  form: UseFormReturn<PurchaseFormInput>;
  lineTotal: number;
  onRemove: () => void;
  removeDisabled: boolean;
  t: ReturnType<typeof useTranslations>;
  locale: Locale;
}) {
  const kind = form.watch(`lines.${index}.itemKind`);
  const itemId = form.watch(`lines.${index}.itemId`);
  const itemName = form.watch(`lines.${index}.itemName`);
  const itemIdError = form.formState.errors.lines?.[index]?.itemId?.message;

  const selected: PurchasableItemOption | null = itemId ? { id: itemId, name: itemName, currentStock: 0, unitSymbol: "" } : null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <ItemPicker
        kind={kind}
        onKindChange={(nextKind) => {
          form.setValue(`lines.${index}.itemKind`, nextKind);
          form.setValue(`lines.${index}.itemId`, "");
          form.setValue(`lines.${index}.itemName`, "");
        }}
        value={selected}
        onChange={(item) => {
          form.setValue(`lines.${index}.itemId`, item?.id ?? "");
          form.setValue(`lines.${index}.itemName`, item?.name ?? "");
        }}
        error={itemIdError}
      />
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <LabeledInput
          id={`lines.${index}.quantity`}
          type="number"
          min={0.01}
          step="0.01"
          label={t("quantity")}
          {...form.register(`lines.${index}.quantity`, { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
        />
        <Controller
          control={form.control}
          name={`lines.${index}.unitCost`}
          render={({ field: costField }) => <MoneyInput id={`lines.${index}.unitCost`} label={t("unitCost")} value={costField.value} onChange={costField.onChange} />}
        />
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={removeDisabled} aria-label={t("removeLine")}>
          <Trash2 className="size-4 text-destructive" aria-hidden />
        </Button>
      </div>
      <p className="text-right text-xs text-muted-foreground">
        {t("lineTotal")}: {formatMoney(lineTotal, locale)}
      </p>
    </div>
  );
}

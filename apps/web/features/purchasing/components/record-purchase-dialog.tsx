"use client"; // form state + line-item field array + mutation

import { useState } from "react";
import Link from "next/link";
import { todayLocalIso } from "@/lib/local-date";
import { Controller, useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { Label } from "@rakhal/ui/ui/label";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/shared/money-input";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { ItemPicker } from "./item-picker";
import { NewItemSheet, type NewItemResult } from "./new-item-sheet";
import { SupplierPicker } from "./supplier-picker";
import { useCreatePurchase } from "../hooks/use-purchasing";
import {
  PURCHASE_PAYMENT_MODES,
  computePurchaseOutstanding,
  computePurchaseTotal,
  purchaseFormSchema,
  purchasePaidAmount,
  type PurchaseFormInput,
  type PurchaseLineFormInput,
} from "../schemas";
import type { CreatePurchaseLinePayload, CreatePurchasePayload, PurchasableItemKind, PurchasableItemOption, PurchaseNewItemKind } from "../types";

const LAST_KIND_KEY = "rakhal.purchase.lastItemKind";
const ITEM_KINDS: PurchasableItemKind[] = ["MEDICINE", "FEED_ITEM", "EQUIPMENT"];

/** Per-viewer convenience only — storage can be blocked or throw (private window), so every access is
 * guarded and the form behaves the same without it. */
function readLastKind(): PurchasableItemKind {
  try {
    const stored = window.localStorage.getItem(LAST_KIND_KEY);
    if (stored && (ITEM_KINDS as string[]).includes(stored)) return stored as PurchasableItemKind;
  } catch {
    /* storage unavailable */
  }
  return "MEDICINE";
}

function rememberKind(kind: PurchasableItemKind): void {
  try {
    window.localStorage.setItem(LAST_KIND_KEY, kind);
  } catch {
    /* storage unavailable — the default kind is a convenience, not state */
  }
}

const NEW_ITEM_KIND_BY_ITEM_KIND: Record<PurchasableItemKind, PurchaseNewItemKind> = {
  MEDICINE: "MEDICINE",
  FEED_ITEM: "FEED",
  EQUIPMENT: "EQUIPMENT",
};

const ITEM_KIND_BY_NEW_ITEM_KIND: Record<PurchaseNewItemKind, PurchasableItemKind> = {
  MEDICINE: "MEDICINE",
  FEED: "FEED_ITEM",
  EQUIPMENT: "EQUIPMENT",
};

const INVENTORY_TAB_BY_KIND: Record<PurchasableItemKind, string> = {
  MEDICINE: "medicine",
  FEED_ITEM: "feed",
  EQUIPMENT: "others",
};

function toLinePayload(line: PurchaseLineFormInput): CreatePurchaseLinePayload {
  const base = {
    quantity: line.quantity,
    unitCost: line.unitCost,
    expiryDate: line.itemKind === "MEDICINE" ? line.expiryDate : undefined,
    batchCode: line.itemKind === "MEDICINE" ? line.batchCode?.trim() || undefined : undefined,
  };
  if (line.newItem) {
    const { kind, name, unitId, medicineType, medicineCategory, ingredientId, feedClass } = line.newItem;
    return {
      ...base,
      newItem: {
        kind,
        name: name.trim(),
        unitId: unitId || undefined,
        ...(kind === "MEDICINE" ? { medicineType, medicineCategory } : {}),
        ...(kind === "FEED" ? { ingredientId, feedClass } : {}),
      },
    };
  }
  return {
    ...base,
    medicineId: line.itemKind === "MEDICINE" ? line.itemId : undefined,
    feedItemId: line.itemKind === "FEED_ITEM" ? line.itemId : undefined,
    equipmentId: line.itemKind === "EQUIPMENT" ? line.itemId : undefined,
  };
}

/** No account and no payment method go on the wire: the backend pays from the farm's single account
 * (`resolveFarmAccountId`) and `CreatePurchaseDto` has no method field. */
function toPayload(values: PurchaseFormInput): CreatePurchasePayload {
  const total = computePurchaseTotal(values.lines);
  const paid = purchasePaidAmount(values.paymentMode, total, values.paidAmount);
  return {
    supplierId: values.supplierId,
    purchaseDate: values.purchaseDate,
    notes: values.notes?.trim() || undefined,
    lines: values.lines.map(toLinePayload),
    paidAmount: paid > 0 ? paid : undefined,
    dueDate: paid < total ? values.dueDate || undefined : undefined,
  };
}

function emptyLine(kind: PurchasableItemKind): PurchaseLineFormInput {
  return { itemKind: kind, itemId: "", itemName: "", quantity: 1, unitCost: 0 };
}

/**
 * Record Purchase — a standalone flow, deliberately separate from Record Expense. A purchase always
 * **increases inventory stock** (Medicine/FeedItem/Equipment) — the primary test scenario mirrors
 * the backend's own worked AC example (`FINANCE_V2_DESIGN.md` §5.1, `CreatePurchaseDto`'s doc
 * comment): "৳30,000 feed purchase, ৳20,000 paid from Bank → Payable 10,000, inventory +quantity".
 * Posts to `POST /purchasing/purchases` (RAKHAL-348, live) — one atomic transaction server-side:
 * document + lines + real stock increment + journal + (if not fully paid) a `Payable`.
 *
 * **Fast path (Business UX Phase 5).** Supplier and item pickers both end in "+ New …": a first-time
 * supplier is added with name + phone, a first-time item is typed as `newItem` and created server-side
 * with the purchase (zero stock + the purchase's own lot, one transaction). The line kind defaults to the
 * last one used. Payment is **Pay in full** (default — nothing to type), **Part paid** (amount) or **On
 * credit** (due date); the farm's single account is resolved server-side, so no wallet or method field.
 *
 * Medicine lines carry their own lot **expiry** (`CreatePurchaseLineDto.expiryDate` is required for a
 * medicine line, existing or new).
 */
export function RecordPurchaseDialog({
  open,
  onOpenChange,
  supplierId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects the supplier (opened from a supplier's own sheet). */
  supplierId?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? <RecordPurchaseDialogBody onOpenChange={onOpenChange} supplierId={supplierId} /> : null}
    </Sheet>
  );
}

function RecordPurchaseDialogBody({ onOpenChange, supplierId }: { onOpenChange: (open: boolean) => void; supplierId?: string }) {
  const t = useTranslations("purchasing.recordPurchase");
  const locale = useLocale() as Locale;
  const createPurchase = useCreatePurchase();
  const [newItemLine, setNewItemLine] = useState<number | null>(null);

  const form = useForm<PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      supplierId,
      purchaseDate: todayLocalIso(),
      lines: [emptyLine(readLastKind())],
      paymentMode: "FULL",
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = form.watch("lines");
  const paymentMode = form.watch("paymentMode");
  const partAmount = form.watch("paidAmount");

  const total = computePurchaseTotal(lines.map((l) => ({ quantity: l.quantity || 0, unitCost: l.unitCost || 0 })));
  const paidNow = purchasePaidAmount(paymentMode, total, partAmount);
  const outstanding = computePurchaseOutstanding(total, paidNow);

  async function onSubmit(values: PurchaseFormInput) {
    try {
      const purchase = await createPurchase.mutateAsync(toPayload(values));
      const firstKind = values.lines[0]?.itemKind ?? "MEDICINE";
      toast.success(t("createdToast", { number: purchase.purchaseNumber }), {
        description: (
          <span className="flex gap-3">
            <Link href={`/inventory?tab=${INVENTORY_TAB_BY_KIND[firstKind]}`} className="font-medium text-primary underline">
              {t("viewStock")}
            </Link>
            <Link href="/finance?tab=transactions" className="font-medium text-primary underline">
              {t("viewFinance")}
            </Link>
          </span>
        ),
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  function onNewItemCreated(index: number, { draft, unitSymbol }: NewItemResult) {
    const kind = ITEM_KIND_BY_NEW_ITEM_KIND[draft.kind];
    rememberKind(kind);
    form.setValue(`lines.${index}.itemKind`, kind);
    form.setValue(`lines.${index}.itemName`, draft.name.trim());
    form.setValue(`lines.${index}.itemStock`, undefined);
    form.setValue(`lines.${index}.itemUnit`, unitSymbol);
    form.setValue(`lines.${index}.newItem`, draft);
    // Last, so the "item required" check already sees the typed item (it passes when `newItem` is set).
    form.setValue(`lines.${index}.itemId`, "", { shouldValidate: true });
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
                <SupplierPicker value={field.value} onChange={field.onChange} error={fieldState.error ? t("supplierRequired") : undefined} />
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
                onCreateNew={() => setNewItemLine(index)}
                t={t}
                locale={locale}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(emptyLine(lines[lines.length - 1]?.itemKind ?? readLastKind()))}
              className="self-start"
            >
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
              name="paymentMode"
              render={({ field }) => (
                <div role="radiogroup" aria-label={t("paymentType")} className="grid grid-cols-3 gap-2">
                  {PURCHASE_PAYMENT_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={field.value === mode}
                      onClick={() => field.onChange(mode)}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-lg border bg-card px-2 text-sm font-medium transition-colors",
                        field.value === mode ? "border-primary bg-success-tint text-primary" : "border-input text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(`paymentMode.${mode}`)}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {paymentMode === "FULL" ? (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t("paidInFullNote", { amount: formatMoney(total, locale) })}</p>
          ) : null}

          {paymentMode === "PART" ? (
            <Controller
              control={form.control}
              name="paidAmount"
              render={({ field, fieldState }) => (
                <MoneyInput
                  id="paidAmount"
                  label={t("amountPaid")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error ? (fieldState.error.message === "belowTotal" ? t("partBelowTotal") : t("amountRequired")) : undefined}
                />
              )}
            />
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

      <NewItemSheet
        open={newItemLine !== null}
        onOpenChange={(next) => !next && setNewItemLine(null)}
        initialKind={NEW_ITEM_KIND_BY_ITEM_KIND[lines[newItemLine ?? 0]?.itemKind ?? "MEDICINE"]}
        onCreate={(result) => newItemLine !== null && onNewItemCreated(newItemLine, result)}
      />
    </SheetContent>
  );
}

/** One `PurchaseLine` row — item picker (kind + search-select, or a typed new item) + quantity + unit
 * cost + (medicine) expiry + live line total. Split out from the parent body so each row only
 * re-renders on its own field changes. */
function PurchaseLineRow({
  index,
  form,
  lineTotal,
  onRemove,
  removeDisabled,
  onCreateNew,
  t,
  locale,
}: {
  index: number;
  form: UseFormReturn<PurchaseFormInput>;
  lineTotal: number;
  onRemove: () => void;
  removeDisabled: boolean;
  onCreateNew: () => void;
  t: ReturnType<typeof useTranslations>;
  locale: Locale;
}) {
  const kind = form.watch(`lines.${index}.itemKind`);
  const itemId = form.watch(`lines.${index}.itemId`);
  const itemName = form.watch(`lines.${index}.itemName`);
  const itemStock = form.watch(`lines.${index}.itemStock`);
  const itemUnit = form.watch(`lines.${index}.itemUnit`);
  const newItem = form.watch(`lines.${index}.newItem`);
  const itemIdError = form.formState.errors.lines?.[index]?.itemId?.message;
  const expiryError = form.formState.errors.lines?.[index]?.expiryDate?.message;

  const selected: PurchasableItemOption | null =
    itemId || newItem ? { id: itemId, name: itemName, currentStock: itemStock ?? 0, unitSymbol: itemUnit ?? "" } : null;

  function clearItem() {
    form.setValue(`lines.${index}.itemId`, "");
    form.setValue(`lines.${index}.itemName`, "");
    form.setValue(`lines.${index}.itemStock`, undefined);
    form.setValue(`lines.${index}.itemUnit`, undefined);
    form.setValue(`lines.${index}.newItem`, undefined);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <ItemPicker
        kind={kind}
        onKindChange={(nextKind) => {
          rememberKind(nextKind);
          form.setValue(`lines.${index}.itemKind`, nextKind);
          clearItem();
        }}
        value={selected}
        isNewItem={Boolean(newItem)}
        onChange={(item) => {
          form.setValue(`lines.${index}.newItem`, undefined);
          form.setValue(`lines.${index}.itemId`, item?.id ?? "", { shouldValidate: Boolean(item) });
          form.setValue(`lines.${index}.itemName`, item?.name ?? "");
          form.setValue(`lines.${index}.itemStock`, item?.currentStock);
          form.setValue(`lines.${index}.itemUnit`, item?.unitSymbol);
        }}
        onCreateNew={onCreateNew}
        error={itemIdError ? t("itemRequired") : undefined}
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
      {kind === "MEDICINE" ? (
        <Controller
          control={form.control}
          name={`lines.${index}.expiryDate`}
          render={({ field }) => (
            <DatePicker id={`lines.${index}.expiryDate`} label={t("expiryDate")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={expiryError ? t("expiryRequired") : undefined} />
          )}
        />
      ) : null}
      <p className="text-right text-xs text-muted-foreground">
        {t("lineTotal")}: {formatMoney(lineTotal, locale)}
      </p>
    </div>
  );
}

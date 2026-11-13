"use client"; // form state, live totals and a single submit

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { formatMoney, formatNumber } from "@/lib/format";
import { todayLocalIso } from "@/lib/local-date";
import type { Locale } from "@/lib/constants/i18n";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { FormSheet } from "@/components/shared/form-sheet";
import { MoneyInput } from "@/components/shared/money-input";
import { MoneyText } from "@/components/shared/money-text";
import { PaymentMethodPicker } from "@/components/shared/payment-method-picker";
import { BuyerPicker } from "@/features/buyers/components/buyer-picker";
import { useBuyersPagedList, useRecordDispatch } from "@/features/buyers/hooks/use-buyers";
import type { Buyer } from "@/features/buyers/types";
import { clampAmountReceived, computeDue, computeLineTotal } from "../domain/sale-math";
import { useMilkAvailability } from "../hooks/use-sales";
import { SELL_MILK_SETTLEMENTS, sellMilkSchema, type SellMilkFormInput, type SellMilkSettlement } from "../schemas";

const LAST_BUYER_KEY = "rakhal.sellMilk.lastBuyerId";

/** Per-viewer convenience only — storage can be blocked or throw (private window), so every access
 * is guarded and the sheet works the same without it. */
function readLastBuyer(): string | undefined {
  try {
    return window.localStorage.getItem(LAST_BUYER_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function rememberBuyer(id: string): void {
  try {
    window.localStorage.setItem(LAST_BUYER_KEY, id);
  } catch {
    /* storage unavailable — the default buyer is a convenience, not state */
  }
}

/** Same `setValueAs` adapter the other plain-`register()` number fields use (`""` -> `undefined`). */
const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

const EMPTY_VALUES: SellMilkFormInput = {
  buyerId: "",
  volumeL: undefined as unknown as number,
  saleDate: "",
  settlement: "PAID_NOW",
  paymentMethod: "CASH",
};

/**
 * One-screen "Sell Milk". A milk sale is three decisions — who bought it, how many litres, and
 * whether the money came now — so that is the whole form: buyer and litres up front (the buyer
 * defaults to the last one used, litres offer "Sell all X L" from the live tank stock), a live total,
 * then Paid now (amount prefilled to the total, Cash preselected) or On credit. Fat %, SCC, date and
 * notes sit under "More options". One submit posts everything atomically server-side — the sale,
 * the milk leaving the tank, the receivable/payment and the Activity Log entry — so there is no
 * client-side chain that can half-finish.
 *
 * The total shown is an estimate (`litres × buyer price`): fat bonus / SCC penalty are applied by the
 * server, and the success toast reports the real figure.
 *
 * `buyerId` pre-selects a buyer (used from a buyer's own page).
 */
export function SellMilkSheet({
  open,
  onOpenChange,
  buyerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerId?: string;
}) {
  const t = useTranslations("sales.sellMilk");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const recordDispatch = useRecordDispatch();
  const buyers = useBuyersPagedList({});
  const availability = useMilkAvailability(open);

  const [showMore, setShowMore] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [settlementTouched, setSettlementTouched] = useState(false);
  const [pickedBuyer, setPickedBuyer] = useState<Buyer | null>(null);

  const form = useForm<SellMilkFormInput>({
    resolver: zodResolver(sellMilkSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ ...EMPTY_VALUES, buyerId: buyerId ?? readLastBuyer() ?? "", saleDate: todayLocalIso() });
    setShowMore(false);
    setAmountTouched(false);
    setSettlementTouched(false);
    setPickedBuyer(null);
  }, [open, buyerId, form]);

  const watchedBuyerId = form.watch("buyerId");
  const volumeL = form.watch("volumeL");
  const settlement = form.watch("settlement");
  const amountReceived = form.watch("amountReceived");
  const paymentMethod = form.watch("paymentMethod");

  const buyer = pickedBuyer?.id === watchedBuyerId ? pickedBuyer : (buyers.items.find((b) => b.id === watchedBuyerId) ?? null);
  const pricePerLitre = buyer?.basePricePerLitre ?? 0;
  const total = computeLineTotal(volumeL, pricePerLitre);
  const availableL = availability.data?.totalAvailableL;
  const overStock = availableL != null && (volumeL ?? 0) > availableL;
  const missingPrice = buyer != null && pricePerLitre <= 0;
  const paidNow = settlement === "PAID_NOW";

  // A buyer on payment terms is a credit sale by default; a walk-up buyer (0 days) pays now.
  const buyerTerms = buyer?.paymentTermsDays;
  useEffect(() => {
    if (settlementTouched || buyerTerms == null) return;
    form.setValue("settlement", buyerTerms > 0 ? "ON_CREDIT" : "PAID_NOW");
  }, [buyerTerms, settlementTouched, form]);

  // Until the farmer types an amount, "paid now" means paid in full.
  useEffect(() => {
    if (!paidNow || amountTouched) return;
    form.setValue("amountReceived", total > 0 ? total : undefined);
  }, [paidNow, amountTouched, total, form]);

  function chooseSettlement(next: SellMilkSettlement) {
    setSettlementTouched(true);
    form.setValue("settlement", next, { shouldValidate: true });
  }

  async function onSubmit(values: SellMilkFormInput) {
    if (!buyer || missingPrice || overStock) return;
    const received = values.settlement === "PAID_NOW" ? clampAmountReceived(values.amountReceived, total) : undefined;
    try {
      const result = await recordDispatch.mutateAsync({
        buyerId: values.buyerId,
        dispatchedAt: values.saleDate,
        volumeDispatchedL: values.volumeL,
        fatPct: values.fatPct,
        scc: values.scc,
        notes: values.notes?.trim() || undefined,
        ...(received != null && received > 0 ? { amountReceived: received, paymentMethod: values.paymentMethod } : {}),
      });
      rememberBuyer(values.buyerId);
      const litres = formatNumber(values.volumeL, locale, { maximumFractionDigits: 2 });
      toast.success(
        result.amountReceived > 0
          ? t("successPaid", { litres, amount: formatMoney(result.amountReceived, locale) })
          : t("successCredit", { litres, amount: formatMoney(result.calculatedAmount, locale) }),
        { action: { label: t("viewInvoices"), onClick: () => router.push("/sales?tab=invoices") } },
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const submitBlocked = recordDispatch.isPending || overStock || missingPrice;

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      onSubmit={form.handleSubmit(onSubmit)}
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={recordDispatch.isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={submitBlocked}>
            {recordDispatch.isPending ? t("saving") : t("submit")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Controller
          control={form.control}
          name="buyerId"
          render={({ field, fieldState }) => (
            <BuyerPicker
              value={field.value || undefined}
              onChange={(id, picked) => {
                field.onChange(id);
                setPickedBuyer(picked);
              }}
              placeholder={t("buyerPlaceholder")}
              error={fieldState.error ? t("buyerRequired") : undefined}
            />
          )}
        />
        {buyer ? (
          <p className={cn("px-1 text-xs", missingPrice ? "text-destructive" : "text-muted-foreground")}>
            {missingPrice
              ? t("noPrice")
              : buyer.paymentTermsDays > 0
                ? t("priceAndTerms", { price: formatMoney(pricePerLitre, locale), days: buyer.paymentTermsDays })
                : t("priceOnly", { price: formatMoney(pricePerLitre, locale) })}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <LabeledInput
          id="sellMilkVolume"
          type="number"
          step="0.01"
          min={0}
          inputMode="decimal"
          label={t("litres")}
          error={overStock ? t("exceedsStock", { amount: formatNumber(availableL ?? 0, locale, { maximumFractionDigits: 2 }) }) : form.formState.errors.volumeL ? t("volumeRequired") : undefined}
          {...form.register("volumeL", numberField)}
        />
        {availableL != null ? (
          <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span>{t("availableNow", { amount: formatNumber(availableL, locale, { maximumFractionDigits: 2 }) })}</span>
            {availableL > 0 ? (
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => form.setValue("volumeL", availableL, { shouldValidate: true })}
              >
                {t("sellAll", { amount: formatNumber(availableL, locale, { maximumFractionDigits: 2 }) })}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t("estimatedTotal")}</p>
          <p className="text-lg font-semibold text-foreground">
            <MoneyText amount={total} />
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("estimateNote")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label={t("paymentTitle")} className="flex gap-2">
          {SELL_MILK_SETTLEMENTS.map((value) => {
            const selected = settlement === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseSettlement(value)}
                className={cn(
                  "flex h-11 flex-1 items-center justify-center rounded-lg border bg-card px-2 text-sm font-medium transition-colors",
                  selected ? "border-primary bg-success-tint text-primary" : "border-input text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "PAID_NOW" ? t("paidNow") : t("onCredit")}
              </button>
            );
          })}
        </div>

        {paidNow ? (
          <>
            <Controller
              control={form.control}
              name="amountReceived"
              render={({ field, fieldState }) => (
                <MoneyInput
                  id="sellMilkAmountReceived"
                  label={t("amountReceived")}
                  value={field.value}
                  onChange={(v) => {
                    setAmountTouched(true);
                    field.onChange(clampAmountReceived(v, total));
                  }}
                  onBlur={field.onBlur}
                  error={fieldState.error ? t("amountRequired") : undefined}
                />
              )}
            />
            {total > 0 && (amountReceived ?? 0) < total ? (
              <p className="px-1 text-xs text-muted-foreground">{t("dueLine", { amount: formatMoney(computeDue(total, amountReceived), locale) })}</p>
            ) : null}
            <PaymentMethodPicker
              value={paymentMethod}
              onChange={(m) => form.setValue("paymentMethod", m)}
              groupLabel={t("paymentMethod")}
              labels={{ CASH: t("methods.CASH"), BANK_TRANSFER: t("methods.BANK_TRANSFER"), MFS: t("methods.MFS") }}
            />
          </>
        ) : (
          <p className="px-1 text-xs text-muted-foreground">
            {buyer && buyer.paymentTermsDays > 0 ? t("creditHint", { days: buyer.paymentTermsDays }) : t("creditHintNoTerms")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          aria-expanded={showMore}
          onClick={() => setShowMore((v) => !v)}
          className="flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} aria-hidden />
          {t("more")}
        </button>
        {showMore ? (
          <div className="flex flex-col gap-4">
            <Controller
              control={form.control}
              name="saleDate"
              render={({ field, fieldState }) => (
                <DatePicker label={t("date")} value={field.value} onChange={field.onChange} placeholder={t("date")} error={fieldState.error ? t("dateRequired") : undefined} />
              )}
            />
            <div className="flex gap-4">
              <LabeledInput id="sellMilkFat" type="number" step="0.1" min={0} label={t("fatPct")} {...form.register("fatPct", numberField)} />
              <LabeledInput id="sellMilkScc" type="number" min={0} step={1} label={t("scc")} {...form.register("scc", numberField)} />
            </div>
            <div>
              <Textarea id="sellMilkNotes" placeholder={t("notesPlaceholder")} className="h-16" {...form.register("notes")} />
              <label htmlFor="sellMilkNotes" className="mt-1 block text-xs text-muted-foreground">
                {t("notes")}
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </FormSheet>
  );
}

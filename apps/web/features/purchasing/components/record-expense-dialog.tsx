"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MoneyInput } from "@/components/shared/money-input";
import { AccountPicker } from "@/features/finance/components/account-picker";
import { useCreateExpense } from "../hooks/use-purchasing";
import { expenseFormSchema, type ExpenseFormInput } from "../schemas";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LEDGER_CODE } from "../types";
import type { RecordExpensePayload } from "../types";

function toPayload(values: ExpenseFormInput): RecordExpensePayload {
  return {
    category: values.category,
    description: values.description.trim(),
    amount: values.amount,
    expenseDate: values.expenseDate,
    financialAccountId: values.paidNow ? values.financialAccountId : undefined,
    dueDate: !values.paidNow && values.dueDate ? values.dueDate : undefined,
    notes: values.notes?.trim() || undefined,
  };
}

/**
 * Record Expense — a standalone flow, deliberately separate from Record Purchase
 * (`FINANCE_V2_DESIGN.md` §5.1: "a feed purchase increases an asset, an electricity bill is an
 * expense"). Posts to `POST /purchasing/expenses` (RAKHAL-348, live).
 *
 * **Category is a closed 5-value enum** (SALARY/UTILITIES/BREEDING/TRANSFER_FEE/DEPRECIATION) —
 * deliberately **no "Other" option**. The backend enum has no OTHER value (no ledger account exists
 * for one yet, filed as RD-060 in `TECH_DEBT.md`) — offering it here would just produce a 400 the
 * farmer can't explain, so it's surfaced honestly instead: only the 5 real categories are selectable,
 * and each option shows a small "posts to Expense · <code>" caption so the closed set doesn't read
 * as an oversight.
 *
 * **Payment shape mirrors `RecordExpenseDto`'s own doc comment** — simpler than Purchase's: a "Paid
 * now" switch either requires an `AccountPicker` selection (paid in full immediately) or, left off,
 * raises the full amount as a `Payable` with an optional due date. No partial-expense amount exists
 * server-side, so this form doesn't invent one.
 */
export function RecordExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? <RecordExpenseDialogBody onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function RecordExpenseDialogBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("purchasing.recordExpense");
  const createExpense = useCreateExpense();

  const form = useForm<ExpenseFormInput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { category: "UTILITIES", description: "", expenseDate: new Date().toISOString().slice(0, 10), paidNow: true },
  });
  const paidNow = form.watch("paidNow");

  async function onSubmit(values: ExpenseFormInput) {
    try {
      await createExpense.mutateAsync(toPayload(values));
      toast.success(t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[560px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[560px]"
    >
      <div className="flex items-center justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        <button type="button" onClick={() => onOpenChange(false)} aria-label={t("close")} className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70">
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <LabeledSelectTrigger label={t("category")} />
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      <span className="flex flex-col">
                        <span>{t(`categoryOptions.${category}`)}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("postsTo", { code: EXPENSE_CATEGORY_LEDGER_CODE[category] })}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          <LabeledInput
            id="description"
            label={t("description")}
            {...form.register("description")}
            error={form.formState.errors.description?.message}
          />

          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <MoneyInput id="amount" label={t("amount")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={form.control}
              name="expenseDate"
              render={({ field, fieldState }) => (
                <DatePicker id="expenseDate" label={t("expenseDate")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} disabledDates={{ after: new Date() }} />
              )}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-input bg-card px-4 py-3">
            <div className="flex flex-col">
              <Label htmlFor="paidNow">{t("paidNow")}</Label>
              <span className="text-xs text-muted-foreground">{t("paidNowHint")}</span>
            </div>
            <Controller control={form.control} name="paidNow" render={({ field }) => <Switch id="paidNow" checked={field.value} onCheckedChange={field.onChange} />} />
          </div>

          {paidNow ? (
            <Controller
              control={form.control}
              name="financialAccountId"
              render={({ field, fieldState }) => (
                <AccountPicker value={field.value} onChange={field.onChange} error={fieldState.error?.message} placeholder={t("payFromAccount")} />
              )}
            />
          ) : (
            <Controller
              control={form.control}
              name="dueDate"
              render={({ field, fieldState }) => (
                <DatePicker id="dueDate" label={t("dueDateOptional")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
              )}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea id="notes" {...form.register("notes")} />
          </div>
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={createExpense.isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={createExpense.isPending}>
            {createExpense.isPending ? "…" : t("record")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}

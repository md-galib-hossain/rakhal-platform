"use client"; // form state + mutation

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { useCreateFinancialAccount, useUpdateFinancialAccount } from "../../hooks/use-finance-v2";
import { editAccountSchema, MFS_PROVIDERS, type EditAccountInput } from "../../schemas-v2";
import type { FinancialAccount, FinancialAccountType, MfsProvider } from "../../types-v2";
import { useState } from "react";

/**
 * RAKHAL-356 — Create/Edit Financial Account. Same `Sheet`-drawer shape as
 * `features/inventory/components/semen-batch-form-dialog.tsx#SemenBatchFormDialog` (this codebase's
 * house convention for a create/edit form drawer — no shared `form-dialog.tsx`/`form-sheet.tsx`
 * component exists to reuse, confirmed by search; every feature hand-rolls this same `Sheet` shell).
 *
 * Create shows a Cash/Bank/MFS type picker (mirrors `AccountPicker`'s quick-add form). **Edit omits
 * type entirely** — per the backend AC, type is immutable after creation (`UpdateFinancialAccountDto`
 * has no `type` field at all, verified against the live source) — re-rendering the create form's
 * type `<Select>` on an edit would silently offer a change the backend would reject.
 */
export function AccountFormSheet({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: FinancialAccount;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <AccountFormSheetBody key={account?.id ?? "create"} onOpenChange={onOpenChange} account={account} /> : null}
    </Sheet>
  );
}

function toFormDefaults(account: FinancialAccount | undefined): Partial<EditAccountInput> {
  if (!account) return { name: "" };
  return {
    name: account.name,
    bankName: account.bankDetail?.bankName ?? "",
    bankAccountNumber: account.bankDetail?.accountNumber ?? "",
    bankBranch: account.bankDetail?.branch ?? "",
    mfsProvider: account.mfsDetail?.provider,
    mfsPhoneNumber: account.mfsDetail?.phoneNumber ?? "",
  };
}

function AccountFormSheetBody({ onOpenChange, account }: { onOpenChange: (open: boolean) => void; account?: FinancialAccount }) {
  const t = useTranslations("finance.accountsPage.form");
  const isEdit = Boolean(account);
  const createAccount = useCreateFinancialAccount();
  const updateAccount = useUpdateFinancialAccount();
  const pending = createAccount.isPending || updateAccount.isPending;

  // Create-only state — not part of the shared zod schema since edit never shows or validates it.
  const [createType, setCreateType] = useState<FinancialAccountType>("CASH");
  const [openingBalance, setOpeningBalance] = useState<number | undefined>(undefined);

  const form = useForm<EditAccountInput>({
    resolver: zodResolver(editAccountSchema),
    defaultValues: toFormDefaults(account),
  });

  const effectiveType: FinancialAccountType = account?.type ?? createType;

  async function onSubmit(values: EditAccountInput) {
    try {
      if (isEdit && account) {
        await updateAccount.mutateAsync({
          id: account.id,
          dto: {
            name: values.name,
            bankDetail:
              account.type === "BANK"
                ? { bankName: values.bankName, accountNumber: values.bankAccountNumber, branch: values.bankBranch }
                : undefined,
            mfsDetail:
              account.type === "MFS"
                ? { provider: values.mfsProvider, phoneNumber: values.mfsPhoneNumber }
                : undefined,
          },
        });
      } else {
        await createAccount.mutateAsync({
          name: values.name,
          type: createType,
          openingBalance,
          bankDetail:
            createType === "BANK"
              ? { bankName: values.bankName ?? "", accountNumber: values.bankAccountNumber ?? "", branch: values.bankBranch || undefined }
              : undefined,
          mfsDetail:
            createType === "MFS"
              ? { provider: (values.mfsProvider ?? "BKASH") as MfsProvider, phoneNumber: values.mfsPhoneNumber ?? "" }
              : undefined,
        });
      }
      toast.success(isEdit ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const bankValid = effectiveType !== "BANK" || (form.watch("bankName")?.trim() && form.watch("bankAccountNumber")?.trim());
  const mfsValid = effectiveType !== "MFS" || form.watch("mfsPhoneNumber")?.trim();
  const canSubmit = Boolean(form.watch("name")?.trim()) && Boolean(bankValid) && Boolean(mfsValid);

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[560px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[560px]"
    >
      <div className="flex items-center justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
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

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-5"
        noValidate
      >
        {!isEdit ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{t("accountType")}</span>
            <Select value={createType} onValueChange={(v) => setCreateType(v as FinancialAccountType)}>
              <LabeledSelectTrigger label={t("accountType")} />
              <SelectContent>
                <SelectItem value="CASH">{t("typeCash")}</SelectItem>
                <SelectItem value="BANK">{t("typeBank")}</SelectItem>
                <SelectItem value="MFS">{t("typeMfs")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("typeImmutable", { type: t(effectiveType === "CASH" ? "typeCash" : effectiveType === "BANK" ? "typeBank" : "typeMfs") })}
          </p>
        )}

        <LabeledInput
          id="account-name"
          label={t("accountName")}
          placeholder={t("accountNamePlaceholder")}
          error={form.formState.errors.name?.message}
          {...form.register("name")}
        />

        {effectiveType === "BANK" ? (
          <>
            <LabeledInput id="bank-name" label={t("bankName")} {...form.register("bankName")} />
            <LabeledInput id="bank-account-number" label={t("bankAccountNumber")} {...form.register("bankAccountNumber")} />
            <LabeledInput id="bank-branch" label={t("bankBranch")} {...form.register("bankBranch")} />
          </>
        ) : null}

        {effectiveType === "MFS" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{t("mfsProvider")}</span>
              <Select
                value={form.watch("mfsProvider") ?? "BKASH"}
                onValueChange={(v) => form.setValue("mfsProvider", v as MfsProvider)}
              >
                <LabeledSelectTrigger label={t("mfsProvider")} />
                <SelectContent>
                  {MFS_PROVIDERS.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {t(`mfsProviderOptions.${provider}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <LabeledInput id="mfs-phone" label={t("mfsPhoneNumber")} {...form.register("mfsPhoneNumber")} />
          </>
        ) : null}

        {!isEdit ? (
          <MoneyInput id="account-opening-balance" label={t("openingBalance")} value={openingBalance} onChange={setOpeningBalance} />
        ) : null}

        <div className="mt-auto flex gap-2 pt-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="flex-1" disabled={pending || !canSubmit}>
            {pending ? "…" : isEdit ? t("save") : t("createdToastAction")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}

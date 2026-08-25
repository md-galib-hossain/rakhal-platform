"use client"; // search-select over the live financial-account list + an inline quick-add form

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Landmark, Plus, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/shared/money-input";
import { useCreateFinancialAccount, useFinancialAccounts } from "../hooks/use-finance-v2";
import type { CreateFinancialAccountPayload, FinancialAccount, FinancialAccountType, MfsProvider } from "../types-v2";

const TYPE_ORDER: { type: FinancialAccountType; labelKey: string; Icon: typeof Wallet }[] = [
  { type: "CASH", labelKey: "typeCash", Icon: Wallet },
  { type: "BANK", labelKey: "typeBank", Icon: Landmark },
  { type: "MFS", labelKey: "typeMfs", Icon: Smartphone },
];

const MFS_PROVIDERS: MfsProvider[] = ["BKASH", "NAGAD", "ROCKET", "UPAY", "OTHER"];

/**
 * `AccountPicker` (RAKHAL-355) — same Popover+Command search-select+inline-quick-add shape as
 * `features/inventory/components/unit-picker.tsx#UnitPicker` (that file's own doc comment is this
 * component's template, per the ticket brief), rebuilt over the new Finance V2 `FinancialAccount`
 * catalogue (`GET`/`POST /finance/accounts`, RAKHAL-335 — live, not mocked) instead of the unit
 * catalogue. Grouped by `type` (Cash/Bank/MFS) the same way `UnitPicker` groups by `dimension`.
 *
 * Differences from `UnitPicker` driven by the real shape of a `FinancialAccount` vs a `Unit`:
 * - The quick-add form is per-type, not a flat set of fields — `type: "BANK"` needs `bankDetail`
 *   (bank name, account number, optional branch), `type: "MFS"` needs `mfsDetail` (provider,
 *   phone, optional account label), `type: "CASH"` needs neither, mirroring
 *   `CreateFinancialAccountDto`'s own `@ValidateIf(type === ...)` conditional requirement exactly.
 * - Opening balance is optional on every type and uses `MoneyInput` (this same ticket's other new
 *   primitive) rather than a plain number field — first real consumer of it in the codebase.
 * - No dimension-style "conversion to base" field exists here; nothing in `AccountPicker` is
 *   unit-of-measure related.
 *
 * Bound via `Controller` in a form dialog (`value`/`onChange` over `FinancialAccount.id`), same as
 * `UnitPicker`'s own doc comment describes for its 3 consuming forms.
 */
export function AccountPicker({
  value,
  onChange,
  placeholder,
  className,
  error,
}: {
  /** Currently selected `FinancialAccount.id`, or `undefined` for none. */
  value: string | undefined;
  onChange: (accountId: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}) {
  const t = useTranslations("finance.accountPicker");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"search" | "custom">("search");
  const [draftType, setDraftType] = useState<FinancialAccountType>("CASH");
  const [draftName, setDraftName] = useState("");
  const [draftOpeningBalance, setDraftOpeningBalance] = useState<number | undefined>(undefined);
  const [draftBankName, setDraftBankName] = useState("");
  const [draftAccountNumber, setDraftAccountNumber] = useState("");
  const [draftBranch, setDraftBranch] = useState("");
  const [draftProvider, setDraftProvider] = useState<MfsProvider>("BKASH");
  const [draftPhoneNumber, setDraftPhoneNumber] = useState("");

  const { data, isLoading } = useFinancialAccounts();
  const createAccount = useCreateFinancialAccount();

  const selected = useMemo(() => data?.find((a) => a.id === value), [data, value]);

  const groupsByType = useMemo(() => {
    const filtered = (data ?? []).filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));
    return TYPE_ORDER.map(({ type, labelKey, Icon }) => ({
      type,
      labelKey,
      Icon,
      options: filtered.filter((a) => a.type === type),
    })).filter((g) => g.options.length > 0);
  }, [data, search]);

  function reset() {
    setSearch("");
    setMode("search");
    setDraftType("CASH");
    setDraftName("");
    setDraftOpeningBalance(undefined);
    setDraftBankName("");
    setDraftAccountNumber("");
    setDraftBranch("");
    setDraftProvider("BKASH");
    setDraftPhoneNumber("");
  }

  function selectAccount(account: FinancialAccount) {
    onChange(account.id);
    setOpen(false);
    reset();
  }

  const isDraftValid =
    draftName.trim().length > 0 &&
    (draftType !== "BANK" || (draftBankName.trim().length > 0 && draftAccountNumber.trim().length > 0)) &&
    (draftType !== "MFS" || draftPhoneNumber.trim().length > 0);

  async function submitCustom() {
    if (!isDraftValid) return;
    const payload: CreateFinancialAccountPayload = {
      name: draftName.trim(),
      type: draftType,
      openingBalance: draftOpeningBalance,
      bankDetail:
        draftType === "BANK"
          ? { bankName: draftBankName.trim(), accountNumber: draftAccountNumber.trim(), branch: draftBranch.trim() || undefined }
          : undefined,
      mfsDetail:
        draftType === "MFS" ? { provider: draftProvider, phoneNumber: draftPhoneNumber.trim() } : undefined,
    };
    const created = await createAccount.mutateAsync(payload);
    selectAccount(created);
  }

  return (
    <div className={cn("w-full", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        // Same non-modal defense-in-depth as `UnitPicker` so this picker never installs its own
        // scroll lock when reused inside a `Sheet`/wizard form drawer.
        modal={false}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-4 py-2 text-left shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring",
              error && "border-destructive focus-within:ring-destructive",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-muted-foreground">{t("account")}</span>
              <span className={cn("truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
                {selected ? selected.name : (placeholder ?? t("selectAccount"))}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0">
          {mode === "search" ? (
            <Command shouldFilter={false}>
              <CommandInput placeholder={t("searchAccount")} value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>{isLoading ? t("loading") : t("noAccountsFound")}</CommandEmpty>
                {groupsByType.map(({ type, labelKey, Icon, options }) => (
                  <CommandGroup key={type} heading={t(labelKey)}>
                    {options.map((account) => (
                      <CommandItem key={account.id} value={account.id} onSelect={() => selectAccount(account)}>
                        <Check className={cn("mr-2 size-4", account.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                        <Icon className="mr-2 size-3.5 shrink-0 opacity-60" aria-hidden />
                        {account.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
              <div className="border-t border-border p-1">
                <button
                  type="button"
                  onClick={() => setMode("custom")}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary transition-colors hover:bg-muted"
                >
                  <Plus className="size-4" aria-hidden />
                  {t("addAccount")}
                </button>
              </div>
            </Command>
          ) : (
            <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto p-3">
              <p className="text-sm font-medium text-foreground">{t("addAccount")}</p>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t("accountType")}</span>
                <Select value={draftType} onValueChange={(v) => setDraftType(v as FinancialAccountType)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("accountType")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_ORDER.map(({ type, labelKey }) => (
                      <SelectItem key={type} value={type}>
                        {t(labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <LabeledInput
                id="account-name"
                label={t("accountName")}
                placeholder={t("accountNamePlaceholder")}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />

              {draftType === "BANK" ? (
                <>
                  <LabeledInput
                    id="bank-name"
                    label={t("bankName")}
                    value={draftBankName}
                    onChange={(e) => setDraftBankName(e.target.value)}
                  />
                  <LabeledInput
                    id="bank-account-number"
                    label={t("bankAccountNumber")}
                    value={draftAccountNumber}
                    onChange={(e) => setDraftAccountNumber(e.target.value)}
                  />
                  <LabeledInput
                    id="bank-branch"
                    label={t("bankBranch")}
                    value={draftBranch}
                    onChange={(e) => setDraftBranch(e.target.value)}
                  />
                </>
              ) : null}

              {draftType === "MFS" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">{t("mfsProvider")}</span>
                    <Select value={draftProvider} onValueChange={(v) => setDraftProvider(v as MfsProvider)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("mfsProvider")} />
                      </SelectTrigger>
                      <SelectContent>
                        {MFS_PROVIDERS.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {t(`mfsProviderOptions.${provider}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <LabeledInput
                    id="mfs-phone"
                    label={t("mfsPhoneNumber")}
                    value={draftPhoneNumber}
                    onChange={(e) => setDraftPhoneNumber(e.target.value)}
                  />
                </>
              ) : null}

              <MoneyInput
                id="account-opening-balance"
                label={t("openingBalance")}
                value={draftOpeningBalance}
                onChange={setDraftOpeningBalance}
              />

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setMode("search")}>
                  {t("back")}
                </Button>
                <Button type="button" size="sm" className="flex-1" disabled={!isDraftValid || createAccount.isPending} onClick={submitCustom}>
                  {createAccount.isPending ? "…" : t("addItem")}
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

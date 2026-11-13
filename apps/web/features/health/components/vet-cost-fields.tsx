"use client"; // controlled inputs owned by the parent treatment form

import { useTranslations } from "next-intl";
import { LabeledInput } from "@rakhal/ui/ui/labeled-field";
import { AccountPicker } from "@/features/finance/components/account-picker";

interface VetCostFieldsProps {
  vetCost: string;
  setVetCost: (value: string) => void;
  accountId: string | undefined;
  setAccountId: (id: string | undefined) => void;
  disabled?: boolean;
}

/** Optional vet fee for a treatment visit, shared by the case Log Treatment tab and Quick Treat. The "Paid from" account
 * only appears once an amount is typed — the backend needs it to post the fee as a cash expense. */
export function VetCostFields({ vetCost, setVetCost, accountId, setAccountId, disabled }: VetCostFieldsProps) {
  const t = useTranslations("health.caseSheet.logTreatment");
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <LabeledInput
        id="treatment-vet-cost"
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        label={t("vetCost")}
        value={vetCost}
        disabled={disabled}
        onChange={(e) => setVetCost(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{t("vetCostHint")}</p>
      {/* One account per farm: the vet fee is paid from it, nothing to choose. */}
      <AccountPicker value={accountId} onChange={setAccountId} />
    </div>
  );
}

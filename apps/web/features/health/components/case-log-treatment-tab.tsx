"use client";

import { useTranslations } from "next-intl";
import { Label } from "@rakhal/ui/ui/label";
import { VetCostFields } from "./vet-cost-fields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TreatmentLine, TreatmentLineProblem } from "../treatment-lines";
import { TreatmentLines } from "./treatment-lines";

export interface CaseLogTreatmentTabHandle {
  lines: TreatmentLine[];
  setLines: (lines: TreatmentLine[]) => void;
  problems?: Record<string, TreatmentLineProblem>;
  disabled?: boolean;
  administeredBy: string;
  /** Vet fee for this visit (string so the input stays controlled), and the account it is paid from. */
  vetCost: string;
  setVetCost: (value: string) => void;
  vetAccountId: string | undefined;
  setVetAccountId: (id: string | undefined) => void;
}

/** Case Management sheet → "Log Treatment" tab (Figma 734:37459): one card per medicine given (inventory picker, dose
 * amount, dose-unit dropdown, route) with "Add another medicine", and an "Administered By" select of the current user
 * (the backend defaults `administeredBy` to the current user server-side if omitted, so this is pre-filled and left
 * disabled rather than a real team-member picker — no Figma frame shows a dropdown of options). */
export function CaseLogTreatmentTab({
  lines,
  setLines,
  problems,
  disabled,
  administeredBy,
  vetCost,
  setVetCost,
  vetAccountId,
  setVetAccountId,
}: CaseLogTreatmentTabHandle) {
  const t = useTranslations("health.caseSheet.logTreatment");

  return (
    <div className="flex flex-col gap-4">
      <TreatmentLines lines={lines} onChange={setLines} problems={problems} allowManual disabled={disabled} />

      <VetCostFields vetCost={vetCost} setVetCost={setVetCost} accountId={vetAccountId} setAccountId={setVetAccountId} disabled={disabled} />

      <div className="flex flex-col gap-2">
        <Label>{t("administeredBy")}</Label>
        <Select value={administeredBy} disabled>
          <SelectTrigger>
            <SelectValue placeholder={administeredBy} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={administeredBy}>{administeredBy}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

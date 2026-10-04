"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TreatmentLine, TreatmentLineProblem } from "../treatment-lines";
import { TreatmentLines } from "./treatment-lines";

export interface CaseLogTreatmentTabHandle {
  lines: TreatmentLine[];
  setLines: (lines: TreatmentLine[]) => void;
  problems?: Record<string, TreatmentLineProblem>;
  disabled?: boolean;
  administeredBy: string;
}

/** Case Management sheet → "Log Treatment" tab (Figma 734:37459): one card per medicine given (inventory picker, dose
 * amount, dose-unit dropdown, route) with "Add another medicine", and an "Administered By" select of the current user
 * (the backend defaults `administeredBy` to the current user server-side if omitted, so this is pre-filled and left
 * disabled rather than a real team-member picker — no Figma frame shows a dropdown of options). */
export function CaseLogTreatmentTab({ lines, setLines, problems, disabled, administeredBy }: CaseLogTreatmentTabHandle) {
  const t = useTranslations("health.caseSheet.logTreatment");

  return (
    <div className="flex flex-col gap-4">
      <TreatmentLines lines={lines} onChange={setLines} problems={problems} disabled={disabled} />

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

"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@rakhal/ui/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountPicker } from "@/features/finance/components/account-picker";
import { SymptomChips } from "./symptom-chips";
import type { CaseSummary, HealthCloseOutcome } from "../types";
import { CaseResultSummary } from "./case-result-summary";

export interface CaseCloseTabState {
  /** `GET /health/cases/:id` → `summary` (RAKHAL-467); shown above the outcome choice. */
  summary?: CaseSummary;
  outcome: HealthCloseOutcome;
  setOutcome: (v: HealthCloseOutcome) => void;
  observation: string;
  setObservation: (v: string) => void;
  // Log Mortality sub-tab fields
  primaryCauseOfDeath: string;
  setPrimaryCauseOfDeath: (v: string) => void;
  vetSignOff: string;
  setVetSignOff: (v: string) => void;
  symptoms: string[];
  setSymptoms: (v: string[]) => void;
  postMortemPerformed: boolean;
  setPostMortemPerformed: (v: boolean) => void;
  disposalMethod: string;
  setDisposalMethod: (v: string) => void;
  disposalCost: string;
  setDisposalCost: (v: string) => void;
  /** Account the disposal cost was paid from; asked for only once a cost is typed. */
  disposalAccountId: string | undefined;
  setDisposalAccountId: (id: string | undefined) => void;
  disposalLocation: string;
  setDisposalLocation: (v: string) => void;
  additionalNotes: string;
  setAdditionalNotes: (v: string) => void;
}

const CAUSE_OPTIONS = ["Disease complication", "Injury/accident", "Calving complication", "Old age", "Unknown", "Other"];
const DISPOSAL_METHODS = ["Burial", "Incineration", "Rendering", "Composting", "Other"];

/** Case Management sheet → "Close Case" tab (Figma 734:39319), and its "Log Mortality" sub-tab
 * (734:40144) revealed when that outcome is selected. Mirrors `CloseHealthCaseDto`/`MortalityDto` —
 * a MORTALITY outcome is actually submitted via `POST /health/cases/:id/mortality`, RECOVERED via
 * `POST /health/cases/:id/close`, both are one "Confirm"/"Save Update" action from the caller. */
export function CaseCloseTab(props: CaseCloseTabState) {
  const t = useTranslations("health.caseSheet.closeCase");
  const isMortality = props.outcome === "MORTALITY";

  return (
    <div className="flex flex-col gap-4">
      {/* RFE-135: decide with the facts in view — days, treatments, protocol, cost so far. */}
      {props.summary ? <CaseResultSummary summary={props.summary} /> : null}

      <div className="flex flex-col gap-2">
        <Label>{t("caseOutcome")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => props.setOutcome("RECOVERED")}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
              !isMortality ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-foreground/30",
            )}
          >
            {t("markAsRecovered")}
          </button>
          <button
            type="button"
            onClick={() => props.setOutcome("MORTALITY")}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
              isMortality ? "border-destructive text-destructive" : "border-border text-muted-foreground hover:border-foreground/30",
            )}
          >
            {t("logMortality")}
          </button>
        </div>
      </div>

      {!isMortality ? (
        <div className="flex flex-col gap-2">
          <Label>{t("staffObservation")}</Label>
          <Textarea
            value={props.observation}
            onChange={(e) => props.setObservation(e.target.value)}
            placeholder={t("staffObservationPlaceholder")}
            rows={4}
          />
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">{t("clinicalDetails")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>{t("primaryCauseOfDeath")}</Label>
              <Select value={props.primaryCauseOfDeath} onValueChange={props.setPrimaryCauseOfDeath}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCause")} />
                </SelectTrigger>
                <SelectContent>
                  {CAUSE_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("vetSignOff")}</Label>
              <Input
                value={props.vetSignOff}
                onChange={(e) => props.setVetSignOff(e.target.value)}
                placeholder={t("selectVet")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("signsAndSymptoms")}</Label>
            <SymptomChips value={props.symptoms} onChange={props.setSymptoms} />
          </div>

          <div className="flex items-center justify-between">
            <Label>{t("postMortemPerformed")}</Label>
            <RadioGroup
              className="grid grid-flow-col gap-4"
              value={props.postMortemPerformed ? "yes" : "no"}
              onValueChange={(v) => props.setPostMortemPerformed(v === "yes")}
            >
              <label className="flex items-center gap-2 text-sm text-foreground">
                <RadioGroupItem value="yes" /> {t("yes")}
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <RadioGroupItem value="no" /> {t("no")}
              </label>
            </RadioGroup>
          </div>

          <p className="text-sm font-medium text-foreground">{t("disposalLogistics")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>{t("disposalMethod")}</Label>
              <Select value={props.disposalMethod} onValueChange={props.setDisposalMethod}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectMethod")} />
                </SelectTrigger>
                <SelectContent>
                  {DISPOSAL_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("disposalCost")}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                <Input
                  type="number"
                  min={0}
                  value={props.disposalCost}
                  onChange={(e) => props.setDisposalCost(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          {/* One account per farm: the disposal cost is paid from it, nothing to choose. */}
          <AccountPicker value={props.disposalAccountId} onChange={props.setDisposalAccountId} />
          <div className="flex flex-col gap-2">
            <Label>{t("disposalLocation")}</Label>
            <Input
              value={props.disposalLocation}
              onChange={(e) => props.setDisposalLocation(e.target.value)}
              placeholder={t("selectLocation")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("additionalNotes")} *</Label>
            <Textarea
              value={props.additionalNotes}
              onChange={(e) => props.setAdditionalNotes(e.target.value)}
              placeholder={t("additionalNotesPlaceholder")}
              rows={3}
            />
          </div>

          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-xs font-medium">{t("mortalityWarning")}</p>
          </div>
        </>
      )}
    </div>
  );
}

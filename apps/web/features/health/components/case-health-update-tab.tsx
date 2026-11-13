"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Label } from "@rakhal/ui/ui/label";
import { Input } from "@rakhal/ui/ui/input";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SymptomChips } from "./symptom-chips";
import type { AppearanceStatus, AppetiteStatus, ClinicalProgress } from "../types";

const CLINICAL_PROGRESS: ClinicalProgress[] = ["IMPROVING", "WORSENING", "STABLE"];
const APPETITE: AppetiteStatus[] = ["NORMAL", "REDUCED", "NONE", "HIGH"];
const APPEARANCE: AppearanceStatus[] = ["BRIGHT", "DULL", "DEPRESSED", "WEAK"];

export interface CaseHealthUpdateTabState {
  clinicalProgress: ClinicalProgress;
  setClinicalProgress: (v: ClinicalProgress) => void;
  symptoms: string[];
  setSymptoms: (v: string[]) => void;
  temperature: string;
  setTemperature: (v: string) => void;
  appetite: AppetiteStatus | undefined;
  setAppetite: (v: AppetiteStatus) => void;
  appearance: AppearanceStatus | undefined;
  setAppearance: (v: AppearanceStatus) => void;
  observation: string;
  setObservation: (v: string) => void;
}

/** Case Management sheet → "Health Update" tab (Figma 734:38378). Selecting a Clinical Progress
 * moves the case's own status (`HealthCase.status`) server-side — `health.service.ts#
 * createHealthUpdate` maps IMPROVING/WORSENING/STABLE 1:1 onto the case status. */
export function CaseHealthUpdateTab(props: CaseHealthUpdateTabState) {
  const t = useTranslations("health.caseSheet.healthUpdate");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>{t("clinicalProgress")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {CLINICAL_PROGRESS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => props.setClinicalProgress(v)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
                props.clinicalProgress === v
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {t(`progress.${v}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("signsAndSymptoms")}</Label>
        <SymptomChips value={props.symptoms} onChange={props.setSymptoms} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-2">
          <Label>{t("temperature")} *</Label>
          <div className="relative">
            <Input
              type="number"
              step="0.1"
              min={35}
              max={45}
              value={props.temperature}
              onChange={(e) => props.setTemperature(e.target.value)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">°C</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("appetite")}</Label>
          <Select value={props.appetite} onValueChange={(v) => props.setAppetite(v as AppetiteStatus)}>
            <SelectTrigger>
              <SelectValue placeholder={t("appetite")} />
            </SelectTrigger>
            <SelectContent>
              {APPETITE.map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`appetiteValue.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("appearance")}</Label>
          <Select value={props.appearance} onValueChange={(v) => props.setAppearance(v as AppearanceStatus)}>
            <SelectTrigger>
              <SelectValue placeholder={t("appearance")} />
            </SelectTrigger>
            <SelectContent>
              {APPEARANCE.map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`appearanceValue.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("staffObservation")}</Label>
        <Textarea
          value={props.observation}
          onChange={(e) => props.setObservation(e.target.value)}
          placeholder={t("staffObservationPlaceholder")}
          rows={4}
        />
      </div>
    </div>
  );
}

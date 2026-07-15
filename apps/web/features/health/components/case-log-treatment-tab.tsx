"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MedicinePicker } from "./medicine-picker";
import { MEDICINE_ROUTES } from "../types";
import type { MedicineOption } from "../api";
import type { LogTreatmentInput } from "../schemas";

export interface CaseLogTreatmentTabHandle {
  medicine: MedicineOption | null;
  setMedicine: (m: MedicineOption | null) => void;
  route: LogTreatmentInput["route"];
  setRoute: (r: LogTreatmentInput["route"]) => void;
  doseAmount: number;
  setDoseAmount: (n: number) => void;
  administeredBy: string;
}

/** Case Management sheet → "Log Treatment" tab (Figma 734:37459): medicine picker, administration
 * route pill-select, a +/- dose-amount stepper, and an "Administered By" select of the current
 * user (the backend defaults `administeredBy` to the current user server-side if omitted, so this
 * is pre-filled and left editable rather than a real team-member picker — no Figma frame shows a
 * dropdown of options, just the single logged-in name). */
export function CaseLogTreatmentTab({
  medicine,
  setMedicine,
  route,
  setRoute,
  doseAmount,
  setDoseAmount,
  administeredBy,
}: CaseLogTreatmentTabHandle) {
  const t = useTranslations("health.caseSheet.logTreatment");
  const [unit] = useState("ml");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>{t("selectMedicine")}</Label>
        <MedicinePicker value={medicine} onValueChange={setMedicine} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("administrationRoute")}</Label>
        <div className="grid grid-cols-4 gap-2">
          {MEDICINE_ROUTES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoute(r)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
                route === r ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {t(`route.${r}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("doseAmount")}</Label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDoseAmount(Math.max(0, doseAmount - 1))}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
            aria-label={t("decreaseDose")}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <div className="relative flex-1">
            <Input
              type="number"
              min={0}
              value={doseAmount}
              onChange={(e) => setDoseAmount(Number(e.target.value) || 0)}
              className="text-center"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {unit}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDoseAmount(doseAmount + 1)}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
            aria-label={t("increaseDose")}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </div>

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

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Box, Syringe } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useSession } from "@/lib/auth/use-session";
import {
  useCloseHealthCase,
  useHealthCaseDetail,
  useHealthUpdate,
  useLogMortality,
  useLogTreatment,
} from "../hooks/use-health";
import { CASE_MANAGE_TABS, type CaseManageTab } from "../types";
import type { MedicineOption } from "../api";
import type {
  AppearanceStatus,
  AppetiteStatus,
  ClinicalProgress,
  HealthCloseOutcome,
  MedicineRoute,
} from "../types";
import { CaseInfoHeader } from "./case-info-header";
import { CaseLogTreatmentTab } from "./case-log-treatment-tab";
import { CaseHealthUpdateTab } from "./case-health-update-tab";
import { CaseCloseTab } from "./case-close-tab";

export interface CaseManagementSheetProps {
  caseId: string | null;
  initialTab?: CaseManageTab;
  onOpenChange: (open: boolean) => void;
}

/** The "Case Management" sheet (Figma 734:37459/38378/39319/40144) — one right-side sheet, one
 * 3-tab segmented control (Log Treatment / Health Update / Close Case), each tab its own form +
 * submit action against the real `health.controller.ts` case-action routes. Re-mounts (via `key`)
 * whenever `caseId` changes so no state leaks between two different cases opened back to back. */
export function CaseManagementSheet({ caseId, initialTab = "logTreatment", onOpenChange }: CaseManagementSheetProps) {
  return (
    <Sheet open={Boolean(caseId)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-[640px]">
        {caseId ? (
          <CaseManagementSheetBody key={caseId} caseId={caseId} initialTab={initialTab} onClose={() => onOpenChange(false)} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function CaseManagementSheetBody({
  caseId,
  initialTab,
  onClose,
}: {
  caseId: string;
  initialTab: CaseManageTab;
  onClose: () => void;
}) {
  const t = useTranslations("health.caseSheet");
  const session = useSession();
  const query = useHealthCaseDetail(caseId);
  const [tab, setTab] = useState<CaseManageTab>(initialTab);

  const logTreatment = useLogTreatment();
  const healthUpdate = useHealthUpdate();
  const closeCase = useCloseHealthCase();
  const logMortality = useLogMortality();
  const pending = logTreatment.isPending || healthUpdate.isPending || closeCase.isPending || logMortality.isPending;

  // Log Treatment tab state
  const [medicine, setMedicine] = useState<MedicineOption | null>(null);
  const [route, setRoute] = useState<MedicineRoute | undefined>("IM");
  const [doseAmount, setDoseAmount] = useState(0);
  const administeredBy = session.data?.user.name ?? "";

  // Health Update tab state
  const [clinicalProgress, setClinicalProgress] = useState<ClinicalProgress>("IMPROVING");
  const [updateSymptoms, setUpdateSymptoms] = useState<string[]>([]);
  const [temperature, setTemperature] = useState("");
  const [appetite, setAppetite] = useState<AppetiteStatus>();
  const [appearance, setAppearance] = useState<AppearanceStatus>();
  const [observation, setObservation] = useState("");

  // Close Case tab state
  const [outcome, setOutcome] = useState<HealthCloseOutcome>("RECOVERED");
  const [closeObservation, setCloseObservation] = useState("");
  const [primaryCauseOfDeath, setPrimaryCauseOfDeath] = useState("");
  const [vetSignOff, setVetSignOff] = useState("");
  const [mortalitySymptoms, setMortalitySymptoms] = useState<string[]>([]);
  const [postMortemPerformed, setPostMortemPerformed] = useState(false);
  const [disposalMethod, setDisposalMethod] = useState("");
  const [disposalCost, setDisposalCost] = useState("");
  const [disposalLocation, setDisposalLocation] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  async function handleSubmit() {
    try {
      if (tab === "logTreatment") {
        await logTreatment.mutateAsync({
          id: caseId,
          dto: {
            medicineId: medicine?.id,
            medicineName: medicine?.name,
            route,
            doseAmount: doseAmount || undefined,
            doseUnit: doseAmount ? "ml" : undefined,
            administeredBy,
          },
        });
        toast.success(t("logTreatment.savedToast"));
      } else if (tab === "healthUpdate") {
        if (!temperature) {
          toast.error(t("healthUpdate.temperatureRequired"));
          return;
        }
        await healthUpdate.mutateAsync({
          id: caseId,
          dto: {
            clinicalProgress,
            symptoms: updateSymptoms,
            temperature: Number(temperature),
            appetite,
            appearance,
            observation: observation || undefined,
          },
        });
        toast.success(t("healthUpdate.savedToast"));
      } else if (outcome === "RECOVERED") {
        await closeCase.mutateAsync({ id: caseId, dto: { outcome: "RECOVERED", observation: closeObservation || undefined } });
        toast.success(t("closeCase.recoveredToast"));
        onClose();
        return;
      } else {
        if (!primaryCauseOfDeath || !additionalNotes) {
          toast.error(t("closeCase.mortalityRequiredFields"));
          return;
        }
        await logMortality.mutateAsync({
          id: caseId,
          dto: {
            deathDate: new Date().toISOString(),
            primaryCauseOfDeath,
            vetSignOff: vetSignOff || undefined,
            symptoms: mortalitySymptoms,
            postMortemPerformed,
            disposalMethod: disposalMethod || undefined,
            disposalCost: disposalCost ? Number(disposalCost) : undefined,
            disposalLocation: disposalLocation || undefined,
            additionalNotes,
          },
        });
        toast.success(t("closeCase.mortalityToast"));
        onClose();
        return;
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t("title")}</SheetTitle>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {query.isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : query.isError || !query.data ? (
          <ErrorState description={t("loadError")} onRetry={() => query.refetch()} />
        ) : (
          <>
            <CaseInfoHeader healthCase={query.data} />

            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
              {CASE_MANAGE_TABS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    tab === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {key === "logTreatment" ? <Syringe className="size-4" aria-hidden /> : <Box className="size-4" aria-hidden />}
                  {t(`tabs.${key}`)}
                </button>
              ))}
            </div>

            {tab === "logTreatment" ? (
              <CaseLogTreatmentTab
                medicine={medicine}
                setMedicine={setMedicine}
                route={route}
                setRoute={setRoute}
                doseAmount={doseAmount}
                setDoseAmount={setDoseAmount}
                administeredBy={administeredBy}
              />
            ) : tab === "healthUpdate" ? (
              <CaseHealthUpdateTab
                clinicalProgress={clinicalProgress}
                setClinicalProgress={setClinicalProgress}
                symptoms={updateSymptoms}
                setSymptoms={setUpdateSymptoms}
                temperature={temperature}
                setTemperature={setTemperature}
                appetite={appetite}
                setAppetite={setAppetite}
                appearance={appearance}
                setAppearance={setAppearance}
                observation={observation}
                setObservation={setObservation}
              />
            ) : (
              <CaseCloseTab
                outcome={outcome}
                setOutcome={setOutcome}
                observation={closeObservation}
                setObservation={setCloseObservation}
                primaryCauseOfDeath={primaryCauseOfDeath}
                setPrimaryCauseOfDeath={setPrimaryCauseOfDeath}
                vetSignOff={vetSignOff}
                setVetSignOff={setVetSignOff}
                symptoms={mortalitySymptoms}
                setSymptoms={setMortalitySymptoms}
                postMortemPerformed={postMortemPerformed}
                setPostMortemPerformed={setPostMortemPerformed}
                disposalMethod={disposalMethod}
                setDisposalMethod={setDisposalMethod}
                disposalCost={disposalCost}
                setDisposalCost={setDisposalCost}
                disposalLocation={disposalLocation}
                setDisposalLocation={setDisposalLocation}
                additionalNotes={additionalNotes}
                setAdditionalNotes={setAdditionalNotes}
              />
            )}
          </>
        )}
      </div>

      {query.data ? (
        <SheetFooter className="border-t border-dashed border-border pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className={cn("flex-1", tab === "closeCase" && outcome === "MORTALITY" && "bg-destructive hover:bg-destructive/90")}
            onClick={handleSubmit}
            disabled={pending}
          >
            {pending
              ? t("saving")
              : tab === "closeCase" && outcome === "MORTALITY"
                ? t("closeCase.confirmDisposal")
                : t("saveUpdate")}
          </Button>
        </SheetFooter>
      ) : null}
    </>
  );
}

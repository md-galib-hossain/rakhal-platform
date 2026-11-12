"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Box, ClipboardList, Syringe } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useUnits } from "@/features/inventory/hooks/use-inventory";
import {
  newTreatmentLine,
  validateTreatmentLines,
  type TreatmentLine,
  type TreatmentLineProblem,
} from "../treatment-lines";
import type { AppearanceStatus, AppetiteStatus, ClinicalProgress, HealthCloseOutcome } from "../types";
import { CaseInfoHeader } from "./case-info-header";
import { CaseOverviewTab } from "./case-overview-tab";
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
export function CaseManagementSheet({ caseId, initialTab = "overview", onOpenChange }: CaseManagementSheetProps) {
  return (
    <Sheet open={Boolean(caseId)} onOpenChange={onOpenChange}>
      <SheetContent className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-[768px]">
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
  const { data: units = [] } = useUnits();
  const [lines, setLines] = useState<TreatmentLine[]>(() => [newTreatmentLine()]);
  const [lineProblems, setLineProblems] = useState<Record<string, TreatmentLineProblem> | undefined>();
  const administeredBy = session.data?.user.name ?? "";
  const [vetCost, setVetCost] = useState("");
  const [vetAccountId, setVetAccountId] = useState<string | undefined>();

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
  const [disposalAccountId, setDisposalAccountId] = useState<string>();
  const [disposalLocation, setDisposalLocation] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  async function handleSubmit() {
    try {
      if (tab === "logTreatment") {
        const check = validateTreatmentLines(lines);
        if (!check.ok) {
          setLineProblems(check.problems);
          toast.error(t("logTreatment.fixLines"));
          return;
        }
        const vet = Number(vetCost) > 0 ? Number(vetCost) : 0;
        if (vet > 0 && !vetAccountId) {
          toast.error(t("logTreatment.vetNeedsAccount"));
          return;
        }
        setLineProblems(undefined);
        // One request per medicine (each deducts its own stock). A line that saved is dropped so a retry after a failure
        // on a later line never logs the first one twice. The vet fee is one charge for the visit, so it rides on the
        // first request only and is cleared once that request lands.
        let remaining = lines;
        let vetPending = vet > 0;
        for (const line of lines) {
          const manual = line.manualName !== null;
          const medicineName = manual ? line.manualName!.trim() : line.medicine!.name;
          try {
            await logTreatment.mutateAsync({
              id: caseId,
              dto: {
                ...(manual ? { outsideInventory: true } : { medicineId: line.medicine!.id }),
                medicineName,
                route: line.route,
                doseAmount: Number(line.doseAmount),
                doseUnit: units.find((u) => u.id === line.doseUnitId)?.symbol,
                doseUnitId: line.doseUnitId,
                administeredBy,
                ...(vetPending ? { vetCost: vet, financialAccountId: vetAccountId } : {}),
              },
            });
            remaining = remaining.filter((l) => l.key !== line.key);
            if (vetPending) {
              vetPending = false;
              setVetCost("");
              setVetAccountId(undefined);
            }
          } catch (err) {
            setLines(remaining);
            const reason = err instanceof ApiError ? err.message : t("genericError");
            toast.error(t("logTreatment.lineFailed", { medicine: medicineName, reason }));
            if (remaining.length < lines.length) toast.success(t("logTreatment.savedCount", { count: lines.length - remaining.length }));
            return;
          }
        }
        setLines([newTreatmentLine()]);
        toast.success(lines.length === 1 ? t("logTreatment.savedToast") : t("logTreatment.savedCount", { count: lines.length }));
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
        const disposal = Number(disposalCost) > 0 ? Number(disposalCost) : 0;
        if (disposal > 0 && !disposalAccountId) {
          toast.error(t("closeCase.disposalNeedsAccount"));
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
            financialAccountId: disposal > 0 ? disposalAccountId : undefined,
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

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1">
        {query.isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : query.isError || !query.data ? (
          <ErrorState description={t("loadError")} onRetry={() => query.refetch()} />
        ) : (
          <>
            <CaseInfoHeader healthCase={query.data} />

            <Tabs value={tab} onValueChange={(v) => setTab(v as CaseManageTab)}>
              <TabsList className="w-full">
                {CASE_MANAGE_TABS.map((key) => {
                  const Icon =
                    key === "overview"
                      ? ClipboardList
                      : key === "logTreatment"
                        ? Syringe
                        : Box;
                  return (
                    <TabsTrigger key={key} value={key} className="flex-1">
                      <Icon className="mr-1.5 size-4" aria-hidden />
                      {t(`tabs.${key}`)}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            {tab === "overview" ? (
              <CaseOverviewTab healthCase={query.data} onNavigate={setTab} />
            ) : tab === "logTreatment" ? (
              <CaseLogTreatmentTab
                lines={lines}
                setLines={setLines}
                problems={lineProblems}
                disabled={logTreatment.isPending}
                administeredBy={administeredBy}
                vetCost={vetCost}
                setVetCost={setVetCost}
                vetAccountId={vetAccountId}
                setVetAccountId={setVetAccountId}
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
                summary={query.data.summary}
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
                disposalAccountId={disposalAccountId}
                setDisposalAccountId={setDisposalAccountId}
                disposalLocation={disposalLocation}
                setDisposalLocation={setDisposalLocation}
                additionalNotes={additionalNotes}
                setAdditionalNotes={setAdditionalNotes}
              />
            )}
          </>
        )}
      </div>

      {query.data && tab !== "overview" ? (
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

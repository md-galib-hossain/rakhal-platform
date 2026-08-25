"use client"; // owns which create-dialog is open + its cattleId prefill

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { ReproductionKpiCards } from "./reproduction-kpi-cards";
import { ReproductionActionPanels } from "./reproduction-action-panels";
import { ReproductionCalvingForecast } from "./reproduction-calving-forecast";
import { ReproductionCowList } from "./reproduction-cow-list";
import { ReproductionEventsFeed } from "./reproduction-events-feed";
import { ProtocolsPanel } from "./protocols/protocols-panel";
import { HeatEventDialog } from "./dialogs/heat-event-dialog";
import { BreedingEventDialog } from "./dialogs/breeding-event-dialog";
import { PregnancyDiagnosisDialog } from "./dialogs/pregnancy-diagnosis-dialog";
import { CalvingEventDialog } from "./dialogs/calving-event-dialog";
import { AbortionEventDialog } from "./dialogs/abortion-event-dialog";
import { DryOffDialog } from "./dialogs/dry-off-dialog";
import { ReturnToHeatDialog } from "./dialogs/return-to-heat-dialog";

type DialogKind =
  | "heat"
  | "breeding"
  | "pregnancyDiagnosis"
  | "calving"
  | "abortion"
  | "dryOff"
  | "returnToHeat"
  | null;

/**
 * Client-side shell for the Reproduction page — holds which create dialog is open and which
 * `cattleId` it should prefill (action-panel rows open a dialog pre-filled with that row's cow;
 * the header buttons open the same dialogs blank). The page itself stays a server component for
 * the static widget layout; this wrapper is the one piece that needs interactivity.
 */
export function ReproductionWorkspace() {
  const t = useTranslations("reproduction");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [cattleId, setCattleId] = useState<string | undefined>(undefined);
  const [calvingPregnancyId, setCalvingPregnancyId] = useState<string | undefined>(undefined);

  function open(kind: DialogKind, forCattleId?: string) {
    setCattleId(forCattleId);
    setDialog(kind);
  }

  /** Calving needs a second id (`pregnancyId`) alongside the cow, kept separate from the generic
   * `cattleId` prefill so the other dialogs' wiring stays untouched. */
  function openCalving(forCattleId?: string, forPregnancyId?: string) {
    setCalvingPregnancyId(forPregnancyId);
    open("calving", forCattleId);
  }

  function close() {
    setDialog(null);
    setCattleId(undefined);
    setCalvingPregnancyId(undefined);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Can I="reproduction.heat">
          <Button variant="outline" onClick={() => open("heat")}>
            {t("actions.recordHeat")}
          </Button>
        </Can>
        <Can I="reproduction.create">
          <Button variant="outline" onClick={() => open("breeding")}>
            {t("actions.recordAi")}
          </Button>
          <Button variant="outline" onClick={() => open("pregnancyDiagnosis")}>
            {t("actions.recordPregnancyCheck")}
          </Button>
          <Button variant="outline" onClick={() => open("abortion")}>
            {t("actions.recordAbortion")}
          </Button>
          <Button variant="outline" onClick={() => openCalving()}>
            {t("actions.recordCalving")}
          </Button>
        </Can>
      </div>

      <ReproductionKpiCards />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReproductionActionPanels
            onRecordAi={(id) => open("breeding", id)}
            onRecordPregnancyCheck={(id) => open("pregnancyDiagnosis", id)}
            onReturnToHeat={(breedingEventId) => open("returnToHeat", breedingEventId)}
            onRecordCalving={(id, pregnancyId) => openCalving(id, pregnancyId)}
            onRecordDryOff={(id) => open("dryOff", id)}
          />
        </div>
        <ReproductionCalvingForecast />
      </div>

      <ReproductionCowList />
      <ReproductionEventsFeed />
      <ProtocolsPanel />

      <HeatEventDialog open={dialog === "heat"} onOpenChange={(next) => !next && close()} defaultCattleId={cattleId} />
      <BreedingEventDialog
        open={dialog === "breeding"}
        onOpenChange={(next) => !next && close()}
        defaultCattleId={cattleId}
      />
      <PregnancyDiagnosisDialog
        open={dialog === "pregnancyDiagnosis"}
        onOpenChange={(next) => !next && close()}
        defaultCattleId={cattleId}
      />
      <CalvingEventDialog
        open={dialog === "calving"}
        onOpenChange={(next) => !next && close()}
        defaultCattleId={cattleId}
        defaultPregnancyId={calvingPregnancyId}
      />
      <AbortionEventDialog
        open={dialog === "abortion"}
        onOpenChange={(next) => !next && close()}
        defaultCattleId={cattleId}
      />
      <DryOffDialog cattleId={cattleId} open={dialog === "dryOff"} onOpenChange={(next) => !next && close()} />
      <ReturnToHeatDialog
        open={dialog === "returnToHeat"}
        onOpenChange={(next) => !next && close()}
        breedingEventId={cattleId}
      />
    </>
  );
}

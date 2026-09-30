"use client"; // owns which create-dialog is open + its cattleId prefill

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Baby, ChevronDown, Heart, HeartCrack, Microscope, Plus, Syringe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCan } from "@/lib/auth/permissions";
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

/** Two related cards side by side: a wider main card + a narrower companion, equal height (grid
 * `stretch`; each card fills its cell). `minmax(0, …)` lets either shrink below its content so a long
 * cow name truncates instead of forcing the row wider. */
const PAIR_ROW =
  "grid grid-cols-1 items-stretch gap-[clamp(0.75rem,0.4rem+1vw,1.25rem)] @4xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]";

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

  // The five create flows collapse into one "Record event" menu (each item is gated by its own
  // permission; the menu vanishes if the user has none). Fewer competing buttons in the header, and
  // the per-cow buttons in the attention list stay the fast path for the common case.
  const can = useCan();
  const recordItems = [
    { key: "heat", icon: Heart, perm: "reproduction.heat", label: t("actions.recordHeat"), hint: t("actions.recordHeatHint"), run: () => open("heat") },
    { key: "ai", icon: Syringe, perm: "reproduction.create", label: t("actions.recordAi"), hint: t("actions.recordAiHint"), run: () => open("breeding") },
    { key: "check", icon: Microscope, perm: "reproduction.create", label: t("actions.recordPregnancyCheck"), hint: t("actions.recordPregnancyCheckHint"), run: () => open("pregnancyDiagnosis") },
    { key: "calving", icon: Baby, perm: "reproduction.create", label: t("actions.recordCalving"), hint: t("actions.recordCalvingHint"), run: () => openCalving() },
    { key: "abortion", icon: HeartCrack, perm: "reproduction.create", label: t("actions.recordAbortion"), hint: t("actions.recordAbortionHint"), run: () => open("abortion") },
  ].filter((item) => can(item.perm));

  return (
    <>
      {/* `@container` scopes the layout to the page's own width (sidebar open or collapsed) and the
          gap scales with `clamp()` — fluid from a 320px phone to an ultrawide, no viewport
          breakpoints in this file. */}
      <div className="@container flex min-w-0 flex-col gap-[clamp(0.75rem,0.4rem+1vw,1.25rem)]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">{t("subtitle")}</p>
          {recordItems.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full @md:w-auto">
                  <Plus aria-hidden />
                  {t("actions.recordEvent")}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
                {recordItems.map(({ key, icon: Icon, label, hint, run }) => (
                  <DropdownMenuItem key={key} onSelect={run} className="items-start gap-3 py-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <ReproductionKpiCards />

        {/* The page reads top to bottom as Overview → Do now → Herd → Timeline, and each pair of related
            cards shares a row (from 56rem wide; stacked below) at equal height instead of every card
            running the full width:
              Do now    — cows needing action  |  cows on a synchronisation protocol
              Herd      — the cow list, full row (a 7-column table needs the width)
              Timeline  — what happened (events)  |  what is coming (calving forecast) */}
        <div className={PAIR_ROW}>
          <ReproductionActionPanels
            onRecordAi={(id) => open("breeding", id)}
            onRecordPregnancyCheck={(id) => open("pregnancyDiagnosis", id)}
            onReturnToHeat={(breedingEventId) => open("returnToHeat", breedingEventId)}
            onRecordCalving={(id, pregnancyId) => openCalving(id, pregnancyId)}
            onRecordDryOff={(id) => open("dryOff", id)}
          />
          <ProtocolsPanel />
        </div>

        <ReproductionCowList />

        <div className={PAIR_ROW}>
          <ReproductionEventsFeed />
          <ReproductionCalvingForecast />
        </div>
      </div>

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

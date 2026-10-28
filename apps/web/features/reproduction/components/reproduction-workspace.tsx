"use client"; // owns dialog state

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Baby,
  ChevronDown,
  Heart,
  HeartCrack,
  Microscope,
  Plus,
  Syringe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type DialogKind =
  | "heat"
  | "breeding"
  | "pregnancyDiagnosis"
  | "calving"
  | "abortion"
  | "dryOff"
  | "returnToHeat"
  | null;

export type SectionId = "kpis" | "operations" | "cows" | "events" | "protocols";

const DEFAULT_SECTIONS: { id: SectionId; label: string }[] = [
  { id: "kpis", label: "Reproduction Highlights" },
  { id: "operations", label: "Needs Attention & Calving Forecast" },
  { id: "cows", label: "Reproduction Cow List" },
  { id: "events", label: "Reproduction Events Feed" },
  { id: "protocols", label: "Reproductive Protocols" },
];

const BALANCED_PAIR = "grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2";

export function ReproductionWorkspace() {
  const t = useTranslations("reproduction");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [cattleId, setCattleId] = useState<string | undefined>(undefined);
  const [calvingPregnancyId, setCalvingPregnancyId] = useState<string | undefined>(undefined);

  function open(kind: DialogKind, forCattleId?: string) {
    setCattleId(forCattleId);
    setDialog(kind);
  }

  function openCalving(forCattleId?: string, forPregnancyId?: string) {
    setCalvingPregnancyId(forPregnancyId);
    open("calving", forCattleId);
  }

  function close() {
    setDialog(null);
    setCattleId(undefined);
    setCalvingPregnancyId(undefined);
  }

  const can = useCan();
  const recordItems = [
    { key: "heat", icon: Heart, perm: "reproduction.heat", label: t("actions.recordHeat"), hint: t("actions.recordHeatHint"), run: () => open("heat") },
    { key: "ai", icon: Syringe, perm: "reproduction.create", label: t("actions.recordAi"), hint: t("actions.recordAiHint"), run: () => open("breeding") },
    { key: "check", icon: Microscope, perm: "reproduction.create", label: t("actions.recordPregnancyCheck"), hint: t("actions.recordPregnancyCheckHint"), run: () => open("pregnancyDiagnosis") },
    { key: "calving", icon: Baby, perm: "reproduction.create", label: t("actions.recordCalving"), hint: t("actions.recordCalvingHint"), run: () => openCalving() },
    { key: "abortion", icon: HeartCrack, perm: "reproduction.create", label: t("actions.recordAbortion"), hint: t("actions.recordAbortionHint"), run: () => open("abortion") },
  ].filter((item) => can(item.perm));

  const renderSectionContent = (id: SectionId) => {
    switch (id) {
      case "kpis":
        return <ReproductionKpiCards />;
      case "operations":
        return (
          <div className={BALANCED_PAIR}>
            <ReproductionActionPanels
              onRecordAi={(id) => open("breeding", id)}
              onRecordPregnancyCheck={(id) => open("pregnancyDiagnosis", id)}
              onReturnToHeat={(breedingEventId) => open("returnToHeat", breedingEventId)}
              onRecordCalving={(id, pregnancyId) => openCalving(id, pregnancyId)}
              onRecordDryOff={(id) => open("dryOff", id)}
            />
            <ReproductionCalvingForecast />
          </div>
        );
      case "cows":
        return <ReproductionCowList />;
      case "events":
        return <ReproductionEventsFeed />;
      case "protocols":
        return <ProtocolsPanel />;
    }
  };

  return (
    <>
      <div className="@container flex min-w-0 flex-col gap-5">
        {/* Top Action Toolbar */}
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl px-1">
          <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>

          {/* Record Event Dropdown */}
          {recordItems.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-9 px-3 shadow-2xs font-medium gap-1.5">
                  <Plus className="size-4" aria-hidden />
                  <span>{t("actions.recordEvent")}</span>
                  <ChevronDown className="size-3.5 text-primary-foreground/80" aria-hidden />
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

        <div className="flex flex-col gap-5">
          {DEFAULT_SECTIONS.map((section) => (
            <section key={section.id} aria-label={section.label} className="min-w-0">
              {renderSectionContent(section.id)}
            </section>
          ))}
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
      <DryOffDialog
        open={dialog === "dryOff"}
        onOpenChange={(next) => !next && close()}
        cattleId={cattleId}
      />
      <ReturnToHeatDialog
        open={dialog === "returnToHeat"}
        onOpenChange={(next) => !next && close()}
      />
    </>
  );
}

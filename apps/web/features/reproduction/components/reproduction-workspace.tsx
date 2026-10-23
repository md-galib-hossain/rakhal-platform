"use client"; // owns dialog state + dnd-kit section sorter & section ordering

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Baby,
  ChevronDown,
  Heart,
  HeartCrack,
  Microscope,
  Plus,
  Sliders,
  Syringe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LAYOUT_TOOLBAR_STICKY,
  LayoutEditControls,
  SectionSorter,
} from "@/components/shared/section-sorter";
import { cn } from "@/lib/utils";
import { useSectionLayout } from "@/lib/hooks/use-section-layout";
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

const STORAGE_KEY = "rakhal_reproduction_layout_order_v1";
const DEFAULT_SECTION_IDS = DEFAULT_SECTIONS.map((s) => s.id);

const BALANCED_PAIR = "grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2";

export function ReproductionWorkspace() {
  const t = useTranslations("reproduction");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [cattleId, setCattleId] = useState<string | undefined>(undefined);
  const [calvingPregnancyId, setCalvingPregnancyId] = useState<string | undefined>(undefined);

  // Layout customization state
  // Draft order while customizing; null = viewing. Saved only by "Save layout".
  const [draft, setDraft] = useState<string[] | null>(null);
  const isCustomizing = draft !== null;
  const { order: sections, save, reset } = useSectionLayout(STORAGE_KEY, DEFAULT_SECTION_IDS);

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

  const getSectionLabel = (id: SectionId) => {
    return DEFAULT_SECTIONS.find((s) => s.id === id)?.label ?? id;
  };

  return (
    <>
      <div className="@container flex min-w-0 flex-col gap-5">
        {/* Top Action & Customization Toolbar */}
        <div
          className={cn(
            "flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl px-1",
            isCustomizing &&
              cn(LAYOUT_TOOLBAR_STICKY, "border border-border bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur-md"),
          )}
        >
          <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
            {isCustomizing ? "Drag a section by its handle to reorder." : t("subtitle")}
          </p>

          <div className="flex items-center gap-2">
            {isCustomizing ? (
              <LayoutEditControls
                onReset={() => {
                  reset();
                  setDraft(null);
                }}
                onCancel={() => setDraft(null)}
                onSave={() => {
                  save(draft);
                  setDraft(null);
                }}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft([...sections])}
                className="h-9 gap-1.5 border-border bg-card px-3 font-medium text-foreground hover:bg-muted"
              >
                <Sliders className="size-4 text-muted-foreground" aria-hidden />
                <span>Customize Layout</span>
              </Button>
            )}

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
        </div>

        {isCustomizing ? (
          <SectionSorter
            sections={DEFAULT_SECTIONS}
            order={draft}
            onChange={setDraft}
            renderSection={(id) => renderSectionContent(id as SectionId)}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {sections.map((id) => (
              <section key={id} aria-label={getSectionLabel(id)} className="min-w-0">
                {renderSectionContent(id)}
              </section>
            ))}
          </div>
        )}
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

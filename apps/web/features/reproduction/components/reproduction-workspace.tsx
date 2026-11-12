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
import { useCattleDetailModal } from "@/features/cattle/context/cattle-detail-modal-context";
import type { EventKey } from "@/features/events/types";
import { ReproductionKpiCards } from "./reproduction-kpi-cards";
import { ReproductionActionPanels } from "./reproduction-action-panels";
import { ReproductionCalvingForecast } from "./reproduction-calving-forecast";
import { ReproductionCowList } from "./reproduction-cow-list";
import { ProtocolsPanel } from "./protocols/protocols-panel";
import { RecordEventLauncher } from "@/features/events/components/record-event-launcher";

export type SectionId = "kpis" | "operations" | "cows" | "protocols";

const DEFAULT_SECTIONS: { id: SectionId; label: string }[] = [
  { id: "kpis", label: "Reproduction Highlights" },
  { id: "operations", label: "Needs Attention & Calving Forecast" },
  { id: "cows", label: "Reproduction Cow List" },
  { id: "protocols", label: "Reproductive Protocols" },
];

const BALANCED_PAIR = "grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2";

export function ReproductionWorkspace() {
  const t = useTranslations("reproduction");
  const [chooseFor, setChooseFor] = useState<EventKey | null>(null);
  const { openCattleDetail } = useCattleDetailModal();

  // Row buttons know the animal: open her workspace with the shared form (`?record=`, RFE-160).
  const recordFor = (key: EventKey, cattleId: string) => openCattleDetail(cattleId, { record: key });

  const can = useCan();
  const recordItems = [
    { key: "heat", icon: Heart, perm: "reproduction.heat", label: t("actions.recordHeat"), hint: t("actions.recordHeatHint"), run: () => setChooseFor("HEAT") },
    { key: "ai", icon: Syringe, perm: "reproduction.create", label: t("actions.recordAi"), hint: t("actions.recordAiHint"), run: () => setChooseFor("SERVICE") },
    { key: "check", icon: Microscope, perm: "reproduction.create", label: t("actions.recordPregnancyCheck"), hint: t("actions.recordPregnancyCheckHint"), run: () => setChooseFor("PREG_CHECK") },
    { key: "calving", icon: Baby, perm: "reproduction.create", label: t("actions.recordCalving"), hint: t("actions.recordCalvingHint"), run: () => setChooseFor("CALVING") },
    { key: "abortion", icon: HeartCrack, perm: "reproduction.create", label: t("actions.recordAbortion"), hint: t("actions.recordAbortionHint"), run: () => setChooseFor("ABORTION") },
  ].filter((item) => can(item.perm));

  const renderSectionContent = (id: SectionId) => {
    switch (id) {
      case "kpis":
        return <ReproductionKpiCards />;
      case "operations":
        return (
          <div className={BALANCED_PAIR}>
            <ReproductionActionPanels
              onRecordAi={(id) => recordFor("SERVICE", id)}
              onRecordPregnancyCheck={(id) => recordFor("PREG_CHECK", id)}
              onReturnToHeat={(id) => recordFor("HEAT", id)}
              onRecordCalving={(id) => recordFor("CALVING", id)}
              onRecordDryOff={(id) => recordFor("DRY_OFF", id)}
            />
            <ReproductionCalvingForecast />
          </div>
        );
      case "cows":
        return <ReproductionCowList />;
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

      <RecordEventLauncher eventKey={chooseFor} onClose={() => setChooseFor(null)} />
    </>
  );
}

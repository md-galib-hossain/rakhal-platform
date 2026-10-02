"use client"; // owns whether the protocol picker is open

import { useState } from "react";
import { ClipboardList, ListChecks, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buildCaseEvents, suggestNext } from "../case-events";
import type { CaseManageTab, HealthCaseDetail } from "../types";
import { CaseResultSummary } from "./case-result-summary";
import { CaseTimeline } from "./case-timeline";
import { ProtocolPicker } from "./protocol-picker";

function NextCard({ icon, title, hint, tone = "primary", children }: { icon: React.ReactNode; title: string; hint?: string; tone?: "primary" | "warning"; children?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-3", tone === "warning" ? "border-warning bg-warning-tint" : "border-primary/40 bg-primary/5")}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 shrink-0", tone === "warning" ? "text-warning" : "text-primary")} aria-hidden>
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

/** RFE-135 — the case's default tab (EPIC_HEALTH_CENTER D4): the result so far, one suggested next action, and the
 * whole story as a timeline. The three action tabs stay as they were; this tab only reads and points at them. */
export function CaseOverviewTab({
  healthCase,
  onNavigate,
}: {
  healthCase: HealthCaseDetail;
  onNavigate: (tab: CaseManageTab) => void;
}) {
  const t = useTranslations("health.caseSheet.overview");
  const [protocolOpen, setProtocolOpen] = useState(false);
  const next = suggestNext(healthCase);
  const events = buildCaseEvents(healthCase);

  return (
    <div className="flex flex-col gap-4">
      {healthCase.summary ? <CaseResultSummary summary={healthCase.summary} /> : null}

      {next?.kind === "applyProtocol" ? (
        <NextCard icon={<ClipboardList className="size-5" />} title={t("next.applyProtocol.title")} hint={t("next.applyProtocol.hint")}>
          {protocolOpen ? (
            <ProtocolPicker caseId={healthCase.id} condition={healthCase.condition} onApplied={() => setProtocolOpen(false)} />
          ) : (
            <Button type="button" className="h-10 w-fit" onClick={() => setProtocolOpen(true)}>
              {t("next.applyProtocol.action")}
            </Button>
          )}
        </NextCard>
      ) : null}

      {next?.kind === "recordStep" ? (
        <NextCard
          tone={next.overdue ? "warning" : "primary"}
          icon={<ListChecks className="size-5" />}
          title={t(next.overdue ? "next.recordStep.overdue" : "next.recordStep.today", { title: next.task.title })}
          hint={t("next.recordStep.hint")}
        >
          <Button type="button" className="h-10 w-fit" onClick={() => onNavigate("logTreatment")}>
            {t("next.recordStep.action")}
          </Button>
        </NextCard>
      ) : null}

      {next?.kind === "closeRecovered" ? (
        <NextCard icon={<ThumbsUp className="size-5" />} title={t("next.closeRecovered.title")} hint={t("next.closeRecovered.hint")}>
          <Button type="button" variant="outline" className="h-10 w-fit" onClick={() => onNavigate("closeCase")}>
            {t("next.closeRecovered.action")}
          </Button>
        </NextCard>
      ) : null}

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">{t("timelineTitle")}</p>
        <CaseTimeline events={events} />
      </div>
    </div>
  );
}

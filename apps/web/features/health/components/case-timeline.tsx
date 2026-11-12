"use client"; // reads the active locale for dates

import { useLocale, useTranslations } from "next-intl";
import { Activity, CheckCircle2, ListChecks, ShieldAlert, Skull, Stethoscope, Syringe, Undo2 } from "lucide-react";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { caseTitle } from "../format";
import type { CaseEvent } from "../case-events";
import type { HealthCondition } from "../types";

const ICON = "size-4";

/** RFE-135 — the case story, newest first (`buildCaseEvents` decides what happened when; this only words and draws
 * it). Reuses the shared `Timeline` primitive. */
export function CaseTimeline({ events, onVoid }: { events: CaseEvent[]; /** Given -> each recorded dose gets a "Void dose" action (the viewer has `healthcare.update`). */ onVoid?: (logId: string) => void }) {
  const t = useTranslations("health.caseSheet.overview.timeline");
  const tCondition = useTranslations("health.reportSickness");
  const locale = useLocale() as Locale;
  const conditionLabel = (c: HealthCondition) => tCondition(`conditionValue.${c}`);

  const items: TimelineItem[] = events.map((event): TimelineItem => {
    const date = formatDateTime(event.at, locale);
    switch (event.kind) {
      case "opened":
        return {
          id: event.id,
          icon: <Stethoscope className={ICON} aria-hidden />,
          tone: "warning",
          title: t("opened", { what: caseTitle({ condition: event.condition as HealthCondition | null, note: event.note }, conditionLabel) }),
          subtitle: [t(`priority.${event.priority}`), event.condition && event.note ? event.note : null, event.actor].filter(Boolean).join(" · "),
          date,
        };
      case "update":
        return {
          id: event.id,
          icon: <Activity className={ICON} aria-hidden />,
          tone: event.progress === "WORSENING" ? "warning" : event.progress === "IMPROVING" ? "success" : "info",
          title: t("update", { progress: t(`progress.${event.progress}`) }),
          subtitle: [event.temperature != null ? `${event.temperature} °C` : null, event.observation, event.actor].filter(Boolean).join(" · "),
          date,
        };
      case "treatment":
        return {
          id: event.id,
          icon: <Syringe className={ICON} aria-hidden />,
          tone: "primary",
          title: t("treatment", { medicine: event.medicine ?? t("unnamedTreatment") }),
          subtitle: [
            event.step ? t("stepOf", { number: event.step.number, total: event.step.total ?? "?" }) : null,
            event.dose,
            event.route,
            event.actor,
          ]
            .filter(Boolean)
            .join(" · "),
          date,
          action: onVoid ? (
            <button type="button" onClick={() => onVoid(event.logId)} className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline">
              <Undo2 className="size-3.5" aria-hidden />
              {t("voidDose")}
            </button>
          ) : undefined,
        };
      case "stepDone":
        return { id: event.id, icon: <ListChecks className={ICON} aria-hidden />, tone: "success", title: t("stepDone", { title: event.title }), date };
      case "step":
        return {
          id: event.id,
          icon: <ShieldAlert className={ICON} aria-hidden />,
          tone: "warning",
          title: t("stepStatus", { status: t(`stepState.${event.status}`), title: event.title }),
          date,
        };
      case "closed":
        return {
          id: event.id,
          icon: <CheckCircle2 className={ICON} aria-hidden />,
          tone: event.status === "RECOVERED" ? "success" : "muted",
          title: t("closed", { status: t(`closedStatus.${event.status}`) }),
          subtitle: event.reason ?? undefined,
          date,
        };
      case "mortality":
        return { id: event.id, icon: <Skull className={ICON} aria-hidden />, tone: "warning", title: t("mortality"), subtitle: event.cause, date };
    }
  });

  return <Timeline items={items} />;
}

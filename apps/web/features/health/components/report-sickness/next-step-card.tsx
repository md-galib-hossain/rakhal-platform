"use client"; // owns the inline protocol picker's selection + pending state

import { useState } from "react";
import { CheckCircle2, ClipboardList, Syringe } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import type { HealthCondition } from "../../types";
import { ProtocolPicker } from "../protocol-picker";

/** RFE-133 — what the sheet becomes after "Report sickness": a case with no plan is an open loop, so the next
 * step is one tap away. Start a protocol (inline picker → `POST /health/cases/:id/apply-plan`, the same route the
 * Sick Bay "Apply protocol" action uses), log the first treatment (opens the Case sheet), or done. */
export function NextStepCard({
  caseId,
  animalName,
  conditionLabel,
  condition,
  initialProtocolOpen,
  onLogTreatment,
  onDone,
}: {
  caseId: string;
  animalName: string;
  conditionLabel: string;
  /** Structured condition — protocols tagged with it are suggested first (RFE-136). */
  condition?: HealthCondition;
  initialProtocolOpen: boolean;
  onLogTreatment: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("health.reportSickness.nextStep");
  const [protocolOpen, setProtocolOpen] = useState(initialProtocolOpen);
  const [applied, setApplied] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-success bg-success-tint p-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-foreground">{t("title", { condition: conditionLabel, name: animalName })}</p>
          <p className="text-sm text-muted-foreground">{applied ? t("protocolStarted", { name: applied }) : t("subtitle")}</p>
        </div>
      </div>

      {applied ? null : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setProtocolOpen((open) => !open)}
            aria-expanded={protocolOpen}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-xl border p-4 text-left transition-colors",
              protocolOpen ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30",
            )}
          >
            <ClipboardList className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{t("startProtocol")}</span>
              <span className="text-xs text-muted-foreground">{t("startProtocolHint")}</span>
            </span>
          </button>

          {protocolOpen ? (
            <ProtocolPicker
              caseId={caseId}
              condition={condition}
              onApplied={(name) => {
                setApplied(name);
                setProtocolOpen(false);
              }}
            />
          ) : null}

          <button
            type="button"
            onClick={onLogTreatment}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-foreground/30"
          >
            <Syringe className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{t("logTreatment")}</span>
              <span className="text-xs text-muted-foreground">{t("logTreatmentHint")}</span>
            </span>
          </button>
        </div>
      )}

      <Button type="button" variant={applied ? "primary" : "secondary"} className="h-12" onClick={onDone}>
        {t("done")}
      </Button>
    </div>
  );
}

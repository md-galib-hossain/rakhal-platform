"use client"; // protocol-picker toggle state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Chip } from "@/components/ui/chip";
import type { BulkCreateHealthCasesResult, HealthCondition } from "../../types";
import type { PickedAnimal } from "../animal-multi-picker";
import { ProtocolPicker } from "../protocol-picker";

const labelOf = (a: PickedAnimal) => a.name ?? a.tagNumber;

/**
 * What a multi-animal Report Sickness did (RFE-139): cases opened, animals skipped because they already had an open
 * case for the condition, and the one follow-up that matters for an outbreak — one protocol on all the new cases.
 */
export function BulkResultCard({
  result,
  condition,
  selected,
  onDone,
}: {
  result: BulkCreateHealthCasesResult;
  condition: HealthCondition;
  selected: Map<string, PickedAnimal>;
  onDone: () => void;
}) {
  const t = useTranslations("health.reportSickness");
  const tb = useTranslations("health.reportSickness.bulk");
  const [protocolOpen, setProtocolOpen] = useState(false);
  const created = result.results.filter((r) => r.status === "created");
  const skipped = result.results.filter((r) => r.status === "skipped");
  const tagOf = (cattleId: string) => {
    const animal = selected.get(cattleId);
    return animal ? labelOf(animal) : cattleId;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-success bg-success-tint p-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-foreground">{tb("result.opened", { count: result.createdCount, condition: t(`conditionValue.${condition}`) })}</p>
          {created.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {created.map((r) => (
                <Chip key={r.cattleId} variant="muted">
                  {tagOf(r.cattleId)}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {skipped.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning bg-warning-tint p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">{tb("result.skipped", { count: skipped.length })}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {skipped.map((r) => (
                <Chip key={r.cattleId} variant="warning">
                  {tagOf(r.cattleId)}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {created.length > 0 ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setProtocolOpen((v) => !v)}
            aria-expanded={protocolOpen}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-xl border p-4 text-left transition-colors",
              protocolOpen ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30",
            )}
          >
            <ClipboardList className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{tb("result.startProtocol")}</span>
              <span className="text-xs text-muted-foreground">{tb("result.startProtocolHint", { count: created.length })}</span>
            </span>
          </button>
          {protocolOpen ? (
            <ProtocolPicker
              caseIds={created.map((r) => (r.status === "created" ? r.healthCaseId : ""))}
              condition={condition}
              onApplied={() => setProtocolOpen(false)}
            />
          ) : null}
        </div>
      ) : null}

      <Button type="button" variant="primary" className="h-12" onClick={onDone}>
        {tb("result.done")}
      </Button>
    </div>
  );
}

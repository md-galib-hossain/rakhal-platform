"use client"; // selection state + a mutation

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@rakhal/ui/ui/button";
import { Chip } from "@/components/ui/chip";
import { useAddRoundAnimals } from "../hooks/use-health";
import type { AddRoundAnimalsResult, ProtocolRound } from "../types";
import { AnimalMultiPicker, type PickedAnimal } from "./animal-multi-picker";
import { farmDay } from "../round-model";

const labelOf = (a: PickedAnimal) => a.name ?? a.tagNumber;

/**
 * RFE-148 (EPIC_PROTOCOL_ROUNDS D7) — add animals to a round that already exists: a cow joins the vaccination that started
 * yesterday instead of starting a second round of its own. The same picker as Report Sickness (by shed, animal group or
 * one by one, up to 100). After saving, the sheet says how many joined and who was skipped because they are already on
 * this protocol — the server never duplicates an animal. Steps that would already be past are due today, not back-dated.
 */
export function RoundAnimalsDialog({ round, open, onOpenChange }: { round: ProtocolRound; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("health.healthPlan.sheet.round.add");
  const formatter = useFormatter();
  const addAnimals = useAddRoundAnimals();
  const [selected, setSelected] = useState<Map<string, PickedAnimal>>(new Map());
  const [noneSelected, setNoneSelected] = useState(false);
  const [done, setDone] = useState<{ result: AddRoundAnimalsResult; selected: Map<string, PickedAnimal> } | null>(null);

  function close(next: boolean) {
    if (!next) {
      setSelected(new Map());
      setNoneSelected(false);
      setDone(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    if (selected.size === 0) {
      setNoneSelected(true);
      return;
    }
    try {
      const result = await addAnimals.mutateAsync({ roundKey: round.roundKey, cattleIds: [...selected.keys()] });
      setDone({ result, selected });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    }
  }

  const description = t("description", {
    protocol: round.healthPlan.name,
    date: formatter.dateTime(farmDay(round.startDate), { day: "numeric", month: "short" }),
  });

  if (done) {
    const skipped = done.result.results.filter((r) => r.status === "skipped");
    const tagOf = (cattleId: string) => {
      const animal = done.selected.get(cattleId);
      return animal ? labelOf(animal) : cattleId;
    };
    return (
      <FormSheet open={open} onOpenChange={close} title={t("title")} onSubmit={() => undefined} footer={<div />}>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-xl border border-success bg-success-tint p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <p className="text-base font-semibold text-foreground">{t("added", { count: done.result.addedCount })}</p>
          </div>
          {skipped.length > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-warning bg-warning-tint p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">{t("skipped", { count: skipped.length })}</p>
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
          <Button type="button" variant="primary" className="h-12" onClick={() => close(false)}>
            {t("done")}
          </Button>
        </div>
      </FormSheet>
    );
  }

  const pending = addAnimals.isPending;
  return (
    <FormSheet
      open={open}
      onOpenChange={close}
      title={t("title")}
      description={description}
      onSubmit={() => void submit()}
      pending={pending}
      footer={
        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="h-12 w-full flex-1" disabled={pending}>
            {pending ? "…" : t("submit", { count: selected.size })}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <AnimalMultiPicker
          selected={selected}
          onChange={(next) => {
            setSelected(next);
            if (next.size > 0) setNoneSelected(false);
          }}
          disabled={pending}
          defaultMethod="search"
        />
        {noneSelected ? <p className="text-xs text-destructive">{t("noneSelected")}</p> : null}
      </div>
    </FormSheet>
  );
}

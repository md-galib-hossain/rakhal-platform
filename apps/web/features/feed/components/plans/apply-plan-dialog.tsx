"use client"; // target-picker state + two chained mutations (create shortcut plan → apply)

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { RadioGroup, RadioGroupItem } from "@rakhal/ui/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { useAnimalGroups } from "@/features/cattle/hooks/use-cattle";
import { useApplyFeedPlan, useCreateFeedPlan } from "../../hooks/use-feed-plans";
import type { FeedConcentrationSummary } from "../../types";
import type {
  ApplyFeedPlanPayload,
  ApplyFeedPlanResult,
  FeedPlan,
  FeedPlanOverlapConflict,
  FeedPlanTarget,
} from "../../plans-types";

/** Apply an existing plan, or (shortcut) turn a TMR / concentrate card into a one-line plan and apply it —
 * "Apply TMR" / "Apply Concentrate" in the co-founder's words. The program is always a plan underneath. */
export type ApplyTarget =
  | { kind: "plan"; plan: Pick<FeedPlan, "id" | "name"> }
  | { kind: "shortcut"; concentration: FeedConcentrationSummary };

function ApplyBody({
  target,
  onClose,
  presetCows,
  onApplied,
}: {
  target: ApplyTarget;
  onClose: () => void;
  presetCows?: { id: string; label: string }[];
  onApplied?: () => void;
}) {
  const t = useTranslations("feed.plans.apply");
  const groups = useAnimalGroups();
  const createPlan = useCreateFeedPlan();
  const applyPlan = useApplyFeedPlan();

  const shortcut = target.kind === "shortcut" ? target.concentration : null;
  const [targetType, setTargetType] = useState<FeedPlanTarget>("INDIVIDUAL");
  const [cows, setCows] = useState<{ id: string; label: string }[]>(presetCows ?? []);
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState(shortcut?.name ?? "");
  const [kg, setKg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<FeedPlanOverlapConflict[] | null>(null);
  const [result, setResult] = useState<ApplyFeedPlanResult | null>(null);
  // If the shortcut plan was created but the apply failed (e.g. an overlap), retry re-applies it
  // instead of creating a duplicate plan.
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);
  const pending = createPlan.isPending || applyPlan.isPending;

  async function submit() {
    setError(null);
    setConflicts(null);
    const kgNumber = Number(kg);
    if (targetType === "INDIVIDUAL" && cows.length === 0) return setError(t("errors.pickCows"));
    if (targetType === "GROUP" && !groupId) return setError(t("errors.pickGroup"));
    if (shortcut && (!name.trim() || !(kgNumber > 0))) return setError(t("errors.shortcutFields"));

    const dto: ApplyFeedPlanPayload =
      targetType === "INDIVIDUAL"
        ? { targetType, cattleIds: cows.map((c) => c.id) }
        : targetType === "GROUP"
          ? { targetType, animalGroupId: groupId }
          : { targetType };

    try {
      let planId = target.kind === "plan" ? target.plan.id : createdPlanId;
      if (!planId && shortcut) {
        const created = await createPlan.mutateAsync({
          name: name.trim(),
          kind: shortcut.kind === "FEED_MIXTURE" ? "TMR_SHORTCUT" : "CONCENTRATE_SHORTCUT",
          lines: [{ lineType: "PREPARED", concentrationId: shortcut.id, kgPerDay: kgNumber }],
        });
        planId = created.id;
        setCreatedPlanId(created.id);
      }
      const applied = await applyPlan.mutateAsync({ id: planId as string, dto });
      setResult(applied);
      toast.success(t("appliedToast"));
      onApplied?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && Array.isArray(err.details?.conflicting_cattle)) {
        setConflicts(err.details.conflicting_cattle as FeedPlanOverlapConflict[]);
      } else {
        setError(err instanceof ApiError ? err.message : t("errors.generic"));
      }
    }
  }

  if (result) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("doneTitle")}</DialogTitle>
          <DialogDescription>{t("doneDescription", { count: result.assignments.length })}</DialogDescription>
        </DialogHeader>
        {result.replaced.length > 0 ? (
          <div className="rounded-lg border border-border bg-muted p-3 text-sm">
            <p className="font-medium text-foreground">{t("replacedTitle")}</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {[...new Set(result.replaced.map((r) => r.plan_name))].map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {result.leaves_group_program.length > 0 ? (
          <div className="rounded-lg border border-warning bg-warning-tint p-3 text-sm text-warning">
            {t("leavesGroup", { count: result.leaves_group_program.length })}
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={onClose}>{t("close")}</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {shortcut ? t("shortcutTitle", { name: shortcut.name }) : t("title", { name: target.kind === "plan" ? target.plan.name : "" })}
        </DialogTitle>
        <DialogDescription>{shortcut ? t("shortcutDescription") : t("description")}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        {shortcut ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apply-plan-name">{t("planName")}</Label>
              <Input id="apply-plan-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apply-plan-kg">{t("kgPerDay")}</Label>
              <Input
                id="apply-plan-kg"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">{t("target")}</p>
          <RadioGroup value={targetType} onValueChange={(v) => setTargetType(v as FeedPlanTarget)} className="flex flex-col gap-2">
            {(["INDIVIDUAL", "GROUP", "HERD"] as const).map((type) => (
              <label
                key={type}
                htmlFor={`apply-target-${type}`}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm"
              >
                <RadioGroupItem id={`apply-target-${type}`} value={type} className="mt-0.5" />
                <span>
                  <span className="font-medium text-foreground">{t(`targets.${type}.label`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`targets.${type}.hint`)}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        {targetType === "INDIVIDUAL" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">{t("cows")}</p>
            <CattlePicker
              placeholder={t("addCow")}
              onValueChange={(id, cow) =>
                setCows((prev) =>
                  prev.some((c) => c.id === id)
                    ? prev
                    : [...prev, { id, label: cow.name ? `${cow.name} (${cow.tagNumber})` : cow.tagNumber }],
                )
              }
            />
            {cows.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {cows.map((c) => (
                  <li key={c.id} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                    {c.label}
                    <button
                      type="button"
                      aria-label={t("removeCow", { name: c.label })}
                      onClick={() => setCows((prev) => prev.filter((x) => x.id !== c.id))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {targetType === "GROUP" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apply-plan-group">{t("group")}</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger id="apply-plan-group">
                <SelectValue placeholder={t("pickGroup")} />
              </SelectTrigger>
              <SelectContent>
                {(groups.data?.items ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} · {t("members", { count: g.memberCount })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {conflicts ? (
          <div role="alert" className="rounded-lg border border-destructive bg-destructive-tint p-3 text-sm text-destructive">
            <p className="font-medium">{t("overlapTitle", { count: conflicts.length })}</p>
            <p className="mt-1 text-xs">{t("overlapHint")}</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {[...new Set(conflicts.map((c) => c.plan_name))].map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {createdPlanId && (error || conflicts) ? <p className="text-xs text-muted-foreground">{t("planSavedNotApplied")}</p> : null}
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button onClick={() => void submit()} disabled={pending}>
          {pending ? "…" : t("apply")}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ApplyPlanDialog({
  target,
  onOpenChange,
  presetCows,
  onApplied,
}: {
  target: ApplyTarget | null;
  onOpenChange: (open: boolean) => void;
  /** Start with these cows already chosen (the Feeding Grid applies a program to the row / ticked cows). */
  presetCows?: { id: string; label: string }[];
  /** Fired once an apply succeeded, so a caller can reload what depends on it. */
  onApplied?: () => void;
}) {
  return (
    <Dialog open={target != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {target ? (
          <ApplyBody
            key={target.kind === "plan" ? target.plan.id : target.concentration.id}
            target={target}
            presetCows={presetCows}
            onApplied={onApplied}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

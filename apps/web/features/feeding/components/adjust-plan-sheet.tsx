"use client"; // scope-choice dialog state + chained create-copy → apply mutations

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChefHat, SlidersHorizontal } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@rakhal/ui/ui/label";
import { RadioGroup, RadioGroupItem } from "@rakhal/ui/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rakhal/ui/ui/select";
import { Can } from "@/lib/auth/permissions";
import { PlanEditorSheet } from "../../feed/components/plans/plan-editor-sheet";
import { CreateFeedDialog } from "../../feed/components/create-feed-dialog";
import { useApplyFeedPlan, useCreateFeedPlan, useFeedPlan } from "../../feed/hooks/use-feed-plans";
import type { FeedConcentrationKind } from "../../feed/types";
import type { FeedGridSection } from "../../feed/plans-types";
import type { ProgramCow } from "../grid-model";

const cowLabel = (c: ProgramCow) => c.name ?? c.tag_number;

/**
 * "Adjust plan" and "Edit recipe" on a program section header (MILESTONE 27, RFE-128). Both need `feed.update`, so a
 * worker sees the fit pills but no edit actions.
 * - **Adjust plan** opens the plan editor in place. For a group / herd plan it first asks whether the change is for
 *   everyone on the plan, or a private copy for one cow (a new individual plan made from this one, applied to her).
 * - **Edit recipe** appears when a made-feed (PREPARED) line is in the plan and something is off. Lots already made keep
 *   the nutrition they were made with; a recipe change only shapes the next batch.
 */
export function AdjustPlanActions({ section, cows }: { section: FeedGridSection; cows: ProgramCow[] }) {
  const t = useTranslations("feeding.programs.adjust");
  const plan = useFeedPlan(section.plan_id);
  const createPlan = useCreateFeedPlan();
  const applyPlan = useApplyFeedPlan();

  const [scopeOpen, setScopeOpen] = useState(false);
  const [scope, setScope] = useState<"all" | "individual">("all");
  const [cowId, setCowId] = useState(cows[0]?.cattle_id ?? "");
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeEdit, setRecipeEdit] = useState<{ id: string; kind: FeedConcentrationKind } | null>(null);

  const recipes = (plan.data?.lines ?? []).filter((l) => l.line_type === "PREPARED" && l.concentration_id);
  const hasGap = section.fit_summary.warn + section.fit_summary.bad > 0;
  const shared = section.via !== "INDIVIDUAL" || cows.length > 1;
  const pending = createPlan.isPending || applyPlan.isPending;

  function startAdjust() {
    if (!shared) return setEditPlanId(section.plan_id);
    setScope("all");
    setCowId(cows[0]?.cattle_id ?? "");
    setScopeOpen(true);
  }

  async function continueAdjust() {
    if (scope === "all") {
      setScopeOpen(false);
      return setEditPlanId(section.plan_id);
    }
    const cow = cows.find((c) => c.cattle_id === cowId);
    if (!cow || !plan.data) return;
    try {
      const copy = await createPlan.mutateAsync({
        name: `${plan.data.name} — ${cowLabel(cow)}`,
        madeForCattleId: cow.cattle_id,
        notes: plan.data.notes ?? undefined,
        lines: plan.data.lines.map((l) => ({
          lineType: l.line_type,
          feedItemId: l.feed_item_id ?? undefined,
          concentrationId: l.concentration_id ?? undefined,
          kgPerDay: l.kg_per_day,
        })),
      });
      await applyPlan.mutateAsync({ id: copy.id, dto: { targetType: "INDIVIDUAL", cattleIds: [cow.cattle_id] } });
      toast.success(t("copyMade", { animal: cowLabel(cow) }));
      setScopeOpen(false);
      setEditPlanId(copy.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Can I="feed.update">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={startAdjust} disabled={!plan.data}>
          <SlidersHorizontal className="size-4" aria-hidden />
          {t("adjustPlan")}
        </Button>
        {hasGap && recipes.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setRecipeOpen(true)}>
            <ChefHat className="size-4" aria-hidden />
            {t("editRecipe")}
          </Button>
        ) : null}
      </div>

      <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("scopeTitle", { plan: section.plan_name })}</DialogTitle>
            <DialogDescription>{t("scopeDescription")}</DialogDescription>
          </DialogHeader>
          <RadioGroup value={scope} onValueChange={(v) => setScope(v as "all" | "individual")} className="gap-3">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="adjust-scope-all" />
              <Label htmlFor="adjust-scope-all">{t("editForAll", { count: cows.length })}</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="individual" id="adjust-scope-individual" />
              <Label htmlFor="adjust-scope-individual">{t("makeIndividual")}</Label>
            </div>
          </RadioGroup>
          {scope === "individual" ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="adjust-scope-cow">{t("forAnimal")}</Label>
              <Select value={cowId} onValueChange={setCowId}>
                <SelectTrigger id="adjust-scope-cow">
                  <SelectValue placeholder={t("forAnimal")} />
                </SelectTrigger>
                <SelectContent>
                  {cows.map((c) => (
                    <SelectItem key={c.cattle_id} value={c.cattle_id}>
                      {cowLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("individualHint")}</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScopeOpen(false)} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void continueAdjust()} disabled={pending || (scope === "individual" && !cowId)}>
              {t("continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanEditorSheet planId={editPlanId} open={editPlanId !== null} onOpenChange={(o) => !o && setEditPlanId(null)} />

      <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recipeTitle")}</DialogTitle>
            <DialogDescription>{t("recipeBanner")}</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {recipes.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                <span className="text-sm">{l.name}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setRecipeOpen(false);
                    setRecipeEdit({ id: l.concentration_id as string, kind: l.recipe_kind ?? "FEED_MIXTURE" });
                  }}
                >
                  {t("editThisRecipe")}
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {recipeEdit ? (
        <CreateFeedDialog
          open
          onOpenChange={(o) => !o && setRecipeEdit(null)}
          editId={recipeEdit.id}
          kind={recipeEdit.kind}
        />
      ) : null}
    </Can>
  );
}

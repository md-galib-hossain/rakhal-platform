"use client"; // react-hook-form line editor + live fit query

import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { FormSheet } from "@/components/shared/form-sheet";
import { useConcentrations } from "../../hooks/use-feed";
import { useCreateFeedPlan, useFeedPlan, useFeedPlanFit, useUpdateFeedPlan } from "../../hooks/use-feed-plans";
import { feedPlanFormSchema, type FeedPlanFormInput, type FeedPlanFormValues } from "../../plans-schema";
import type { FeedFitNutrient, FeedFitSeverity, FeedPlan } from "../../plans-types";
import { ProductLinePicker } from "../product-line-picker";

const SEVERITY_VARIANT: Record<FeedFitSeverity, "success" | "warning" | "destructive"> = {
  ok: "success",
  warn: "warning",
  bad: "destructive",
};

const num = (v: number | null | undefined) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2));

/** "Does it fit?" — what the saved plan supplies vs one reference animal's requirement, per nutrient. */
function PlanFitPanel({ plan }: { plan: FeedPlan }) {
  const t = useTranslations("feed.plans.fit");
  const [cowId, setCowId] = useState<string | undefined>(plan.made_for_cattle_id ?? undefined);
  const fit = useFeedPlanFit(plan.id, cowId ? [cowId] : []);
  const cow = fit.data?.cows[0];

  const rows: {
    key: "dm" | "cp" | "me";
    label: string;
    supply: number | undefined;
    need: number | undefined;
    nutrient: FeedFitNutrient | undefined;
  }[] = [
    { key: "dm", label: t("dm"), supply: fit.data?.supply.dm_kg, need: cow?.requirement.dm_kg, nutrient: cow?.fit.dm },
    { key: "cp", label: t("cp"), supply: fit.data?.supply.cp_kg, need: cow?.requirement.cp_kg, nutrient: cow?.fit.cp },
    { key: "me", label: t("me"), supply: fit.data?.supply.me_mj, need: cow?.requirement.me_mj, nutrient: cow?.fit.me },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-3" aria-label={t("title")}>
      <div>
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
      <CattlePicker value={cowId} onValueChange={(id) => setCowId(id)} placeholder={t("pickCow")} />
      {!cowId ? (
        <p className="text-xs text-muted-foreground">{t("pickCowFirst")}</p>
      ) : fit.isLoading ? (
        <CardSkeleton lines={3} />
      ) : fit.isError || !fit.data || !cow ? (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-normal">{t("nutrient")}</th>
                <th className="py-1 font-normal">{t("supplies")}</th>
                <th className="py-1 font-normal">{t("needs")}</th>
                <th className="py-1 text-right font-normal">{t("difference")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="py-1.5 text-foreground">{r.label}</td>
                  <td className="py-1.5">{num(r.supply)}</td>
                  <td className="py-1.5">{num(r.need)}</td>
                  <td className="py-1.5 text-right">
                    {r.nutrient ? (
                      <Badge variant={SEVERITY_VARIANT[r.nutrient.severity]}>
                        {r.nutrient.delta_pct == null ? "—" : `${r.nutrient.delta_pct > 0 ? "+" : ""}${r.nutrient.delta_pct}%`}
                      </Badge>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cow.fit.estimated ? <p className="text-xs text-warning">{t("estimated")}</p> : null}
          {!fit.data.supply_complete ? <p className="text-xs text-warning">{t("supplyIncomplete")}</p> : null}
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {fit.data.lines
              .filter((l) => !l.stock_ok)
              .map((l) => (
                <li key={l.line_id}>{t("noStock", { name: l.name })}</li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PlanEditorForm({ plan, onOpenChange }: { plan: FeedPlan | undefined; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("feed.plans.editor");
  const tKind = useTranslations("feed.plans.kind");
  const concentrations = useConcentrations();
  const createPlan = useCreateFeedPlan();
  const updatePlan = useUpdateFeedPlan();

  const form = useForm<FeedPlanFormInput, unknown, FeedPlanFormValues>({
    resolver: zodResolver(feedPlanFormSchema),
    defaultValues: {
      name: plan?.name ?? "",
      notes: plan?.notes ?? "",
      lines: (plan?.lines ?? []).map((l) => ({
        lineType: l.line_type,
        feedItemId: l.feed_item_id ?? undefined,
        concentrationId: l.concentration_id ?? undefined,
        name: l.name ?? "",
        kgPerDay: l.kg_per_day,
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = useWatch({ control: form.control, name: "lines" });
  const pending = createPlan.isPending || updatePlan.isPending;
  const isShortcut = plan != null && plan.kind !== "PLAN";

  const usedItemIds = lines.filter((l) => l.lineType === "FEED_ITEM").map((l) => l.feedItemId as string);
  const usedRecipeIds = lines.filter((l) => l.lineType === "PREPARED").map((l) => l.concentrationId as string);
  const recipeOptions = (concentrations.data ?? []).filter((c) => !usedRecipeIds.includes(c.id));

  const submit = form.handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      notes: values.notes?.trim() || undefined,
      lines: values.lines.map((l) => ({
        lineType: l.lineType,
        ...(l.lineType === "FEED_ITEM" ? { feedItemId: l.feedItemId } : { concentrationId: l.concentrationId }),
        kgPerDay: l.kgPerDay,
      })),
    };
    try {
      if (plan) await updatePlan.mutateAsync({ id: plan.id, dto: payload });
      else await createPlan.mutateAsync(payload);
      toast.success(t("saved"));
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("genericError");
      if (err instanceof ApiError && err.status === 409) form.setError("name", { message: "nameTaken" });
      else toast.error(message);
    }
  });

  const errText = (key: string | undefined) => (key ? t(`errors.${key}` as never) : undefined);

  return (
    <FormSheet
      open
      onOpenChange={onOpenChange}
      title={plan ? t("editTitle") : t("createTitle")}
      description={isShortcut ? t("shortcutNote", { kind: tKind(plan.kind) }) : t("description")}
      onSubmit={() => void submit()}
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
      pending={pending}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-name">{t("name")}</Label>
        <Input id="plan-name" maxLength={80} error={errText(form.formState.errors.name?.message)} {...form.register("name")} />
        {form.formState.errors.name ? (
          <p role="alert" className="text-xs text-destructive">
            {errText(form.formState.errors.name.message)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-notes">{t("notes")}</Label>
        <Textarea id="plan-notes" rows={2} maxLength={1000} {...form.register("notes")} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{t("lines")}</p>
          <div className="flex items-center gap-2">
            <ProductLinePicker
              excludedItemIds={usedItemIds}
              onSelect={(item) => append({ lineType: "FEED_ITEM", feedItemId: item.id, name: item.name, kgPerDay: 1 })}
            />
            <Select
              value=""
              onValueChange={(id) => {
                const c = (concentrations.data ?? []).find((x) => x.id === id);
                if (c) append({ lineType: "PREPARED", concentrationId: c.id, name: c.name, kgPerDay: 1 });
              }}
            >
              <SelectTrigger className="h-8 w-auto gap-1.5 text-xs" aria-label={t("addRecipe")}>
                <SelectValue placeholder={t("addRecipe")} />
              </SelectTrigger>
              <SelectContent>
                {recipeOptions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">{t("noRecipes")}</p>
                ) : (
                  recipeOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.is_finalized ? "" : ` · ${t("notMadeYet")}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">{t("noLines")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {fields.map((field, index) => (
              <li key={field.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{lines[index]?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {lines[index]?.lineType === "PREPARED" ? t("typeRecipe") : t("typeItem")}
                  </p>
                  {form.formState.errors.lines?.[index]?.kgPerDay ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errText(form.formState.errors.lines[index]?.kgPerDay?.message)}
                    </p>
                  ) : null}
                </div>
                <Controller
                  control={form.control}
                  name={`lines.${index}.kgPerDay`}
                  render={({ field: f }) => (
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={0}
                      aria-label={t("kgPerDayFor", { name: lines[index]?.name ?? "" })}
                      className="w-24"
                      value={Number.isNaN(f.value) || f.value == null ? "" : f.value}
                      onChange={(e) => f.onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
                      onBlur={f.onBlur}
                    />
                  )}
                />
                <span className="text-xs text-muted-foreground">{t("kgUnit")}</span>
                <button
                  type="button"
                  aria-label={t("removeLine", { name: lines[index]?.name ?? "" })}
                  onClick={() => remove(index)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {form.formState.errors.lines?.message ? (
          <p role="alert" className="text-xs text-destructive">
            {errText(form.formState.errors.lines.message)}
          </p>
        ) : null}
      </div>

      {plan ? <PlanFitPanel plan={plan} /> : <p className="text-xs text-muted-foreground">{t("fitAfterSave")}</p>}
    </FormSheet>
  );
}

/** Create (`planId = null`) or edit (`planId` set) a feed plan. Mounts the form only once the plan has loaded
 * so `useForm` gets its real default values. */
export function PlanEditorSheet({
  planId,
  open,
  onOpenChange,
}: {
  planId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const plan = useFeedPlan(planId ?? undefined);
  if (!open) return null;
  if (planId && !plan.data) return null;
  return <PlanEditorForm key={planId ?? "new"} plan={plan.data} onOpenChange={onOpenChange} />;
}

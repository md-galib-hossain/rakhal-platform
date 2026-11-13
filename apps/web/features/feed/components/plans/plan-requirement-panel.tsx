"use client"; // animal / hand-entered figures state + debounced live preview query

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@rakhal/ui/ui/badge";
import { Input } from "@rakhal/ui/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rakhal/ui/ui/select";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { usePreviewPlanFit } from "../../hooks/use-feed-plans";
import type { FeedFitSeverity, FeedPlanLineInput, ManualRequirementInput, PreviewFitPayload } from "../../plans-types";

const SEVERITY_VARIANT: Record<FeedFitSeverity, "success" | "warning" | "destructive"> = {
  ok: "success",
  warn: "warning",
  bad: "destructive",
};

const num = (v: number | null | undefined) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2));
const toNum = (s: string) => (s.trim() === "" ? undefined : Number(s));

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

interface LineLike {
  lineType: "FEED_ITEM" | "PREPARED";
  feedItemId?: string;
  concentrationId?: string;
  kgPerDay: number;
}

/**
 * The plan editor's requirement scratchpad — "what does she need, and does this plan give it?", while the plan is
 * being built (like the TMR builder), saved or not. The animal is a saved cow or figures typed by hand; neither is
 * stored with the plan (a plan can be applied to anyone later). The table follows the kg typed in the form, a moment
 * after each keystroke.
 */
export function PlanRequirementPanel({
  lines,
  defaultCattleId,
}: {
  lines: LineLike[];
  /** The plan's own "made for" animal, when it has one — otherwise the panel starts on hand-entered figures. */
  defaultCattleId?: string;
}) {
  const t = useTranslations("feed.plans.fit");
  const [mode, setMode] = useState<"animal" | "manual">(defaultCattleId ? "animal" : "manual");
  const [cattleId, setCattleId] = useState<string | undefined>(defaultCattleId);
  const [manual, setManual] = useState({
    weight: "450",
    milk: "15",
    type: "COW" as "COW" | "HEIFER" | "DRY",
    dim: "",
    gestation: "",
    bcs: "",
    fat: "",
  });
  const [more, setMore] = useState(false);
  const set = (patch: Partial<typeof manual>) => setManual((m) => ({ ...m, ...patch }));

  // Only lines that are complete enough to judge: a feed chosen and a positive kg.
  const validLines: FeedPlanLineInput[] = lines
    .filter(
      (l) =>
        Number.isFinite(l.kgPerDay) &&
        l.kgPerDay > 0 &&
        (l.lineType === "FEED_ITEM" ? !!l.feedItemId : !!l.concentrationId),
    )
    .map((l) => ({
      lineType: l.lineType,
      ...(l.lineType === "FEED_ITEM" ? { feedItemId: l.feedItemId } : { concentrationId: l.concentrationId }),
      kgPerDay: l.kgPerDay,
    }));

  const weight = toNum(manual.weight);
  const milk = toNum(manual.milk);
  const manualOk =
    weight != null &&
    Number.isFinite(weight) &&
    weight >= 1 &&
    weight <= 2000 &&
    milk != null &&
    Number.isFinite(milk) &&
    milk >= 0 &&
    milk <= 100;
  const linesKey = JSON.stringify(validLines);
  const payloadKey = useMemo(() => {
    let payload: PreviewFitPayload | null = null;
    if (mode === "animal" && cattleId) payload = { lines: JSON.parse(linesKey) as FeedPlanLineInput[], cattleId };
    else if (mode === "manual" && manualOk) {
      const m: ManualRequirementInput = {
        weightKg: weight as number,
        milkTargetL: milk as number,
        animalType: manual.type,
        milkFatPct: toNum(manual.fat),
        dim: toNum(manual.dim),
        gestationDays: toNum(manual.gestation),
        bcs: toNum(manual.bcs),
      };
      payload = { lines: JSON.parse(linesKey) as FeedPlanLineInput[], manual: m };
    }
    return payload ? JSON.stringify(payload) : "";
  }, [mode, cattleId, manualOk, weight, milk, manual, linesKey]);
  const debounced = useDebounced(payloadKey, 400);
  const payload = useMemo(() => (debounced ? (JSON.parse(debounced) as PreviewFitPayload) : null), [debounced]);
  const preview = usePreviewPlanFit(payload);
  const data = preview.data;
  const hasLines = validLines.length > 0;

  const field = (id: string, label: string, value: string, onChange: (v: string) => void, unit?: string, step = "1") => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("h-9", unit && "pr-10")}
        />
        {unit ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-3" aria-label={t("title")}>
      <div>
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("scratchHint")}</p>
      </div>

      <div role="tablist" aria-label={t("modeLabel")} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["animal", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === m ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`mode.${m}`)}
          </button>
        ))}
      </div>

      {mode === "animal" ? (
        <CattlePicker value={cattleId} onValueChange={(id) => setCattleId(id)} placeholder={t("pickCow")} />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {field("req-weight", t("manual.weight"), manual.weight, (v) => set({ weight: v }), "kg")}
            {field("req-milk", t("manual.milk"), manual.milk, (v) => set({ milk: v }), "L", "0.5")}
          </div>
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="flex w-fit items-center gap-1 text-xs font-medium text-primary"
          >
            {more ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
            {more ? t("manual.less") : t("manual.more")}
          </button>
          {more ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("manual.type")}</Label>
                <Select value={manual.type} onValueChange={(v) => set({ type: v as "COW" | "HEIFER" | "DRY" })}>
                  <SelectTrigger className="h-9" aria-label={t("manual.type")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["COW", "HEIFER", "DRY"] as const).map((v) => (
                      <SelectItem key={v} value={v}>
                        {t(`manual.types.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {field("req-dim", t("manual.dim"), manual.dim, (v) => set({ dim: v }), t("manual.days"))}
              {field("req-gest", t("manual.gestation"), manual.gestation, (v) => set({ gestation: v }), t("manual.days"))}
              {field("req-bcs", t("manual.bcs"), manual.bcs, (v) => set({ bcs: v }), undefined, "0.25")}
              {field("req-fat", t("manual.fat"), manual.fat, (v) => set({ fat: v }), "%", "0.1")}
            </div>
          ) : null}
          {!manualOk ? <p className="text-xs text-warning">{t("manual.invalid")}</p> : null}
        </div>
      )}

      {mode === "animal" && !cattleId ? (
        <p className="text-xs text-muted-foreground">{t("pickCowFirst")}</p>
      ) : mode === "manual" && !manualOk ? null : !payload && !data ? (
        <p className="text-xs text-muted-foreground">{t("waiting")}</p>
      ) : preview.isError && !data ? (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      ) : !data ? (
        <CardSkeleton lines={4} />
      ) : (
        <>
          {data.source === "MANUAL" && data.manual ? (
            <div className="flex flex-col gap-1 text-xs">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Badge variant="outline">{t("manualBadge")}</Badge>
                {t("manualNote")}
              </p>
              {data.manual.stale ? (
                <p className="text-warning">
                  {data.manual.animal_type_changed
                    ? t("manualStaleType")
                    : t("manualStale", {
                        pct: Math.round(Math.max(data.manual.drift.dm_pct, data.manual.drift.cp_pct, data.manual.drift.me_pct)),
                      })}
                </p>
              ) : null}
            </div>
          ) : null}
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
              {data.nutrients.map((r) => (
                <tr key={r.key} className="border-t border-border align-top">
                  <td className="py-1.5 text-foreground">
                    {t(`n.${r.key}`)}
                    {r.unit !== ": 1" ? <span className="text-muted-foreground"> ({r.unit})</span> : null}
                  </td>
                  <td className="py-1.5 tabular-nums" title={r.measured || !hasLines ? undefined : t("notMeasuredHint")}>
                    {!hasLines || r.supply == null
                      ? "—"
                      : r.measured
                        ? num(r.supply)
                        : r.supply > 0
                          ? `≥ ${num(r.supply)}` // a floor: some fed batch lacks this value
                          : "—"}
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {num(r.requirement)}
                    {r.max != null ? (
                      <span className="block text-xs text-muted-foreground">{t("maxHint", { value: num(r.max) })}</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 text-right">
                    {!hasLines ? null : r.severity === "unknown" ? (
                      <Badge variant="outline">{r.requirement == null ? t("notSet") : t("notMeasured")}</Badge>
                    ) : r.delta_pct == null ? (
                      <span className="text-xs text-muted-foreground">{r.requirement == null ? t("infoOnly") : "—"}</span>
                    ) : (
                      <Badge variant={SEVERITY_VARIANT[r.severity]}>
                        {r.delta_pct > 0 ? "+" : ""}
                        {r.delta_pct}%
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!hasLines ? <p className="text-xs text-muted-foreground">{t("addFeedsHint")}</p> : null}
          {hasLines && data.nutrients.some((r) => !r.measured) ? (
            <p className="text-xs text-muted-foreground">{t("someNotMeasured")}</p>
          ) : null}
          {data.flags.length > 0 ? (
            <p className="text-xs text-warning">
              {t("estimatedBecause", {
                reasons: data.flags.map((f) => (t.has(`flag.${f}`) ? t(`flag.${f}`) : f.replace(/_/g, " "))).join(", "),
              })}
            </p>
          ) : null}
          {hasLines && !data.supply_complete ? <p className="text-xs text-warning">{t("supplyIncomplete")}</p> : null}
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {data.lines
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

"use client"; // per-cow line quantities, extras and confirm/save mutations

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnimalLink } from "@/components/shared/animal-link";
import { Can } from "@/lib/auth/permissions";
import { useFeedActiveSessions } from "../../feed/hooks/use-feed";
import { useConfirmProgram, useSaveProgramDraft } from "../../feed/hooks/use-feed-plans";
import { ProductLinePicker } from "../../feed/components/product-line-picker";
import type { FeedGridCow, FeedGridDraft } from "../../feed/types";
import type {
  FeedGridDraftPlanFields,
  FeedGridProgramCowFields,
  FeedGridSection,
  ProgramGridEntry,
} from "../../feed/plans-types";

export type ProgramCow = Omit<FeedGridCow, "drafts"> &
  FeedGridProgramCowFields & { drafts: (FeedGridDraft & FeedGridDraftPlanFields)[] };

/** An off-plan "+ extra" line: bought feed the cow got on top of (or instead of) her program. */
interface ExtraLine {
  key: string;
  feedItemId: string;
  name: string;
  kg: string;
}

const numberOr0 = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Pre-fill: a saved draft for that plan line wins, else the section's per-session plan kg. Drafts that match no plan
 * line (extras, or a line an edited plan no longer has) come back as extras so nothing staged is lost. */
function initialState(section: FeedGridSection, cows: ProgramCow[]) {
  const qty: Record<string, Record<string, string>> = {};
  const extras: Record<string, ExtraLine[]> = {};
  const refusal: Record<string, string> = {};
  const lineIds = new Set(section.lines.map((l) => l.line_id));
  for (const cow of cows) {
    qty[cow.cattle_id] = {};
    for (const line of section.lines) {
      const draft = cow.drafts.find((d) => d.plan_line_id === line.line_id);
      qty[cow.cattle_id][line.line_id] = String(
        draft ? draft.offered_kg : (cow.planned_kg_by_line[line.line_id] ?? line.prefill_kg),
      );
    }
    extras[cow.cattle_id] = cow.drafts
      .filter(
        (d) => (!d.plan_line_id || !lineIds.has(d.plan_line_id)) && d.source_type === "FEED_ITEM" && d.feed_item_id,
      )
      .map((d) => ({ key: d.id, feedItemId: d.feed_item_id as string, name: "", kg: String(d.offered_kg) }));
    const draftRefusal = cow.drafts.reduce((s, d) => s + (d.refusal_kg ?? 0), 0);
    if (draftRefusal > 0) refusal[cow.cattle_id] = String(draftRefusal);
  }
  return { qty, extras, refusal };
}

/**
 * One feeding **program** on the Feeding Grid (MILESTONE 27, RFE-127): a section per resolved plan, its lines as
 * columns pre-filled with the plan's kg (daily kg ÷ the farm's active sessions), a single refusal per cow (the server
 * splits it across the lines), "+ extra" for off-plan feed, and **Confirm as planned** — a plain client-side fill of
 * every row plus a normal multi-line confirm, no special endpoint. Stock moves only on confirm.
 */
export function ProgramSection({ date, section, cows }: { date: string; section: FeedGridSection; cows: ProgramCow[] }) {
  const t = useTranslations("feeding.programs");
  const tKind = useTranslations("feed.plans.kind");
  const sessions = useFeedActiveSessions();
  const saveDraft = useSaveProgramDraft();
  const confirm = useConfirmProgram();
  const [state, setState] = useState(() => initialState(section, cows));
  const [session, setSession] = useState("");
  const activeSessions = sessions.data ?? [];
  // A farm with one session feeds a cow once a day: confirming a cow that is already confirmed would double-feed her.
  const skipConfirmed = activeSessions.length <= 1;

  const pending = saveDraft.isPending || confirm.isPending;
  const noSourceLines = section.lines.filter((l) => l.source == null);
  const noStockLines = section.lines.filter((l) => l.source != null && !l.stock_ok);

  function setQty(cattleId: string, lineId: string, value: string) {
    setState((s) => ({ ...s, qty: { ...s.qty, [cattleId]: { ...s.qty[cattleId], [lineId]: value } } }));
  }
  function setExtra(cattleId: string, key: string, patch: Partial<ExtraLine> | null) {
    setState((s) => {
      const list = s.extras[cattleId] ?? [];
      const next =
        patch === null ? list.filter((x) => x.key !== key) : list.map((x) => (x.key === key ? { ...x, ...patch } : x));
      return { ...s, extras: { ...s.extras, [cattleId]: next } };
    });
  }
  function addExtra(cattleId: string, item: { id: string; name: string }) {
    setState((s) => ({
      ...s,
      extras: {
        ...s.extras,
        [cattleId]: [
          ...(s.extras[cattleId] ?? []),
          { key: `${item.id}-${Date.now()}`, feedItemId: item.id, name: item.name, kg: "1" },
        ],
      },
    }));
  }

  function buildEntries(only?: ProgramCow[]): ProgramGridEntry[] {
    const entries: ProgramGridEntry[] = [];
    for (const cow of only ?? cows) {
      const lines: ProgramGridEntry["lines"] = [];
      for (const line of section.lines) {
        const kg = numberOr0(state.qty[cow.cattle_id]?.[line.line_id]);
        if (kg <= 0 || !line.source) continue;
        lines.push({
          planLineId: line.line_id,
          sourceType: line.source.source_type,
          feedItemId: line.source.feed_item_id ?? undefined,
          feedStockId: line.source.feed_stock_id ?? undefined,
          offeredKg: kg,
        });
      }
      for (const ex of state.extras[cow.cattle_id] ?? []) {
        const kg = numberOr0(ex.kg);
        if (kg > 0) lines.push({ sourceType: "FEED_ITEM", feedItemId: ex.feedItemId, offeredKg: kg });
      }
      if (lines.length === 0) continue;
      const refusalKg = numberOr0(state.refusal[cow.cattle_id]);
      entries.push({ cattleId: cow.cattle_id, refusalKg: refusalKg > 0 ? refusalKg : undefined, lines });
    }
    return entries;
  }

  async function handleSave() {
    const entries = buildEntries();
    if (entries.length === 0) return toast.error(t("noEntries"));
    try {
      const result = await saveDraft.mutateAsync({ date, entries });
      toast.success(t("savedToast", { count: result.saved }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleConfirm() {
    const target = skipConfirmed ? cows.filter((c) => !(c.confirmed_offered_kg && c.confirmed_offered_kg > 0)) : cows;
    const entries = buildEntries(target);
    if (entries.length === 0) return toast.error(target.length === 0 ? t("allConfirmed") : t("noEntries"));
    try {
      const result = await confirm.mutateAsync({ date, session: session || undefined, entries });
      toast.success(t("confirmedToast", { count: result.cows.length }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const { ok, warn, bad } = section.fit_summary;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-3" aria-label={section.plan_name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{section.plan_name}</h3>
            <Badge variant="info">{tKind(section.kind)}</Badge>
            <Badge variant="outline">{t(`via.${section.via}`)}</Badge>
            {section.conflict ? (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="size-3" aria-hidden />
                {t("conflict")}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("cows", { count: cows.length })}
            {bad + warn > 0 ? ` · ${t("needsAttention", { count: bad + warn })}` : ok > 0 ? ` · ${t("allFit")}` : ""}
          </p>
        </div>
        <Can I="feed.distribution-log">
          <div className="flex flex-wrap items-center gap-2">
            {activeSessions.length > 1 ? (
              <Select value={session} onValueChange={setSession}>
                <SelectTrigger className="h-9 w-32" aria-label={t("session")}>
                  <SelectValue placeholder={t("session")} />
                </SelectTrigger>
                <SelectContent>
                  {activeSessions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => void handleSave()} disabled={pending}>
              {t("saveDraft")}
            </Button>
            <Button size="sm" onClick={() => void handleConfirm()} disabled={pending}>
              <CheckCircle2 className="size-4" aria-hidden />
              {t("confirmAsPlanned")}
            </Button>
          </div>
        </Can>
      </div>

      {noSourceLines.length > 0 ? (
        <p role="status" className="text-xs text-warning">
          {t("noBatch", { names: noSourceLines.map((l) => l.name).join(", ") })}
        </p>
      ) : null}
      {noStockLines.length > 0 ? (
        <p role="status" className="text-xs text-warning">
          {t("noStock", { names: noStockLines.map((l) => l.name).join(", ") })}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("animal")}</TableHead>
              {section.lines.map((l) => (
                <TableHead key={l.line_id} className="min-w-28">
                  {l.name}
                  <span className="block text-xs font-normal text-muted-foreground">{t("kg")}</span>
                </TableHead>
              ))}
              <TableHead className="min-w-24">{t("refusal")}</TableHead>
              <TableHead className="min-w-40">{t("extra")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cows.map((cow) => {
              const confirmed = cow.confirmed_offered_kg != null && cow.confirmed_offered_kg > 0;
              return (
                <TableRow key={cow.cattle_id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <AnimalLink id={cow.cattle_id} animalName={cow.name} tagNumber={cow.tag_number} showTag />
                      {confirmed ? (
                        <span className="text-xs text-success">
                          {t("confirmedToday", { kg: cow.confirmed_offered_kg as number })}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  {section.lines.map((l) => (
                    <TableCell key={l.line_id}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        className="w-24"
                        aria-label={t("lineKgFor", { animal: cow.name ?? cow.tag_number, line: l.name })}
                        disabled={!l.source}
                        value={state.qty[cow.cattle_id]?.[l.line_id] ?? ""}
                        onChange={(e) => setQty(cow.cattle_id, l.line_id, e.target.value)}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      className="w-20"
                      aria-label={t("refusalFor", { animal: cow.name ?? cow.tag_number })}
                      value={state.refusal[cow.cattle_id] ?? ""}
                      onChange={(e) =>
                        setState((s) => ({ ...s, refusal: { ...s.refusal, [cow.cattle_id]: e.target.value } }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {(state.extras[cow.cattle_id] ?? []).map((ex) => (
                        <div key={ex.key} className="flex items-center gap-1">
                          <span className="max-w-24 truncate text-xs text-foreground">{ex.name || t("extraFeed")}</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.1"
                            className="h-8 w-16"
                            aria-label={t("extraKgFor", { animal: cow.name ?? cow.tag_number })}
                            value={ex.kg}
                            onChange={(e) => setExtra(cow.cattle_id, ex.key, { kg: e.target.value })}
                          />
                          <button
                            type="button"
                            aria-label={t("removeExtra")}
                            onClick={() => setExtra(cow.cattle_id, ex.key, null)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      ))}
                      <ProductLinePicker
                        excludedItemIds={(state.extras[cow.cattle_id] ?? []).map((x) => x.feedItemId)}
                        onSelect={(item) => addExtra(cow.cattle_id, { id: item.id, name: item.name })}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

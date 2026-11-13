"use client"; // live query + local void-dialog state, scoped to one cow

import { useState } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/constants/i18n";
import { ArrowRightToLine, Undo2, Wheat } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Can } from "@/lib/auth/permissions";
import { useFeedCattleHistory, useVoidFeedCattleItem } from "../../feed/hooks/use-feed";
import type {
  FeedCattleHistoryEntry,
  FeedCattleHistoryRequirement,
  FeedCattleHistoryResult,
  FeedCattleHistoryTotals,
} from "../../feed/types";
import { todayLocalIso } from "../grid-model";

const todayIso = todayLocalIso;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One tile per nutrient. `required` reads the cow's requirement for that day — the same full profile her cow-profile
 * card shows; RDP/RUP are stored as % of crude protein, so they convert to kg against her CP requirement. Starch has
 * no requirement (information only). */
const NUTRIENT_ROWS: Array<{
  key: keyof FeedCattleHistoryTotals;
  labelKey: string;
  unit: string;
  required?: (r: FeedCattleHistoryRequirement) => number | null;
}> = [
  { key: "dm_kg", labelKey: "nutrition.dmKg", unit: "kg", required: (r) => r.dm_kg },
  { key: "cp_kg", labelKey: "nutrition.cpKg", unit: "kg", required: (r) => r.cp_kg },
  { key: "me_mj", labelKey: "nutrition.meMj", unit: "MJ", required: (r) => r.me_mj },
  { key: "fat_kg", labelKey: "nutrition.fatKg", unit: "kg", required: (r) => r.fat_kg },
  { key: "ndf_kg", labelKey: "nutrition.ndfKg", unit: "kg", required: (r) => r.ndf_kg },
  { key: "adf_kg", labelKey: "nutrition.adfKg", unit: "kg", required: (r) => r.adf_kg },
  { key: "starch_kg", labelKey: "nutrition.starchKg", unit: "kg" },
  { key: "tdn_kg", labelKey: "nutrition.tdnKg", unit: "kg", required: (r) => r.tdn_kg },
  { key: "calcium_kg", labelKey: "nutrition.calciumKg", unit: "kg", required: (r) => r.calcium_kg },
  { key: "phosphorus_kg", labelKey: "nutrition.phosphorusKg", unit: "kg", required: (r) => r.phosphorus_kg },
  { key: "rdp_kg", labelKey: "nutrition.rdpKg", unit: "kg", required: (r) => round2((r.cp_kg * r.rdp_pct) / 100) },
  { key: "rup_kg", labelKey: "nutrition.rupKg", unit: "kg", required: (r) => round2((r.cp_kg * r.rup_pct) / 100) },
];

/** RAKHAL-441 follow-up (user request) — total nutrition actually fed this day next to what the cow needs, a fixed
 * section below the scrollable entry list. A nutrient no fed feed carries reads "not measured", never a fake 0. */
function NutritionTotals({
  totals,
  requirement,
  measured,
}: {
  totals: FeedCattleHistoryTotals;
  requirement: FeedCattleHistoryRequirement | null;
  measured: FeedCattleHistoryResult["measured"];
}) {
  const t = useTranslations("feeding.grid.cowHistory");
  return (
    <div className="flex flex-col gap-2 border-t border-dashed border-border pt-3">
      <span className="text-sm font-bold text-foreground">
        {t(requirement ? "nutritionVsRequiredTitle" : "nutritionTitle")}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {NUTRIENT_ROWS.map((row) => {
          const required = requirement && row.required ? row.required(requirement) : null;
          const fed = totals[row.key];
          // Older backends send no `measured` map — then trust the number as before.
          const isMeasured = measured ? measured[row.key] : true;
          const pct = isMeasured && required != null && required > 0 ? Math.round((fed / required) * 100) : null;
          return (
            <div
              key={row.key}
              className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-2.5 shadow-xs"
            >
              <span className="text-xs font-bold text-muted-foreground">{t(row.labelKey)}</span>
              {isMeasured ? (
                <span className="text-base font-semibold text-foreground">
                  {fed} {row.unit}
                </span>
              ) : (
                <span className="text-base font-semibold text-muted-foreground" title={t("notMeasuredHint")}>
                  {t("notMeasured")}
                </span>
              )}
              {required != null ? (
                <span className="text-xs text-muted-foreground">
                  {t("requiredOf", { required, unit: row.unit })}
                  {pct != null ? ` · ${pct}%` : ""}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * RAKHAL-441 frontend twin (per-cow) — "what has THIS cow been fed" trail, opened from a History
 * icon on that cow's own Feeding Grid row (not a central day-wide view — corrected per user
 * request). Same right-side floating-sheet chrome as `FeedItemDetailSheet` (`ArrowRightToLine`
 * close icon, `showClose={false}`, rounded floating card), not the wider dual-side pattern
 * `ConcentrationDetailSheet` uses for its big recipe table.
 */
export function FeedingCowHistorySheet({
  cattleId,
  cattleName,
  initialDate,
  onOpenChange,
}: {
  cattleId: string | null;
  cattleName: string | null;
  /** The Feeding Grid's selected date — the sheet opens on it, then the user may change it in here. The parent
   * remounts this sheet (keyed by cow) on every open, so the initial value is always current. The requirement shown
   * beside "fed" comes back with the history for whichever date is selected, so it always matches. */
  initialDate: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("feeding.grid.cowHistory");
  const locale = useLocale() as Locale;
  const [date, setDate] = useState<string>(initialDate);
  const query = useFeedCattleHistory(cattleId ?? undefined, date);
  const entries = query.data?.entries ?? [];
  const [voidTarget, setVoidTarget] = useState<FeedCattleHistoryEntry | null>(null);

  const activeEntries = entries.filter((entry) => entry.voided_at == null);
  const totalKg = activeEntries.reduce((sum, entry) => sum + entry.offered_kg, 0);
  const totalCost = activeEntries.reduce((sum, entry) => sum + (entry.cost_tk ?? 0), 0);

  return (
    <>
      <Sheet open={cattleId != null} onOpenChange={onOpenChange}>
        <SheetContent
          showClose={false}
          className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[560px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[560px]"
        >
          <div className="flex items-center justify-between pb-5">
            <SheetTitle className="text-xl font-bold text-foreground">
              {cattleName ? t("titleFor", { name: cattleName }) : t("title")}
            </SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t("close")}
              className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
            >
              <ArrowRightToLine className="size-5" aria-hidden />
            </button>
          </div>
          <div className="border-t border-dashed border-border" />

          <div className="flex flex-col gap-3 py-3">
            <DatePicker
              label={t("dateLabel")}
              value={date}
              onChange={(next) => setDate(next || todayIso())}
              disabledDates={{ after: new Date() }}
            />
            {!query.isLoading && !query.isError && entries.length > 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                {t("summary", { count: activeEntries.length, kg: totalKg, cost: totalCost })}
              </div>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1 py-1">
            {query.isLoading ? (
              <CardSkeleton lines={4} />
            ) : query.isError ? (
              <ErrorState description={t("error")} onRetry={() => query.refetch()} />
            ) : entries.length === 0 ? (
              <EmptyState title={t("empty")} />
            ) : (
              entries.map((entry) => {
                const isVoided = entry.voided_at != null;
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors",
                      isVoided && "border-dashed bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
                        isVoided && "bg-muted text-muted-foreground",
                      )}
                    >
                      <Wheat className="size-4" aria-hidden />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-semibold text-foreground",
                            isVoided && "text-muted-foreground line-through",
                          )}
                        >
                          {entry.feed_name ?? "—"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.fed_at, locale, { hour: "numeric", minute: "2-digit" })}
                      </span>
                      {isVoided ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {t("voidedHint", { reason: entry.void_reason || t("noReason") })}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          "text-sm font-semibold text-foreground",
                          isVoided && "text-muted-foreground line-through",
                        )}
                      >
                        {entry.offered_kg} kg
                      </span>
                      {entry.refusal_kg > 0 ? (
                        <span
                          className={cn(
                            "text-xs text-muted-foreground",
                            isVoided && "line-through",
                          )}
                        >
                          {t("refusalHint", { kg: entry.refusal_kg })}
                        </span>
                      ) : null}
                      {entry.cost_tk != null ? (
                        <span
                          className={cn(
                            "text-xs text-muted-foreground",
                            isVoided && "line-through",
                          )}
                        >
                          ৳{entry.cost_tk}
                        </span>
                      ) : null}
                    </div>
                    {isVoided ? null : (
                      <Can I="feed.delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={t("voidAction")}
                          onClick={() => setVoidTarget(entry)}
                        >
                          <Undo2 className="size-4" />
                        </Button>
                      </Can>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {query.data && activeEntries.length > 0 ? (
            <NutritionTotals
              totals={query.data.totals}
              requirement={query.data.requirement ?? null}
              measured={query.data.measured}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <VoidEntryDialog
        entry={voidTarget}
        cattleId={cattleId}
        date={date}
        onOpenChange={(next) => {
          if (!next) setVoidTarget(null);
        }}
      />
    </>
  );
}

function VoidEntryDialog({
  entry,
  cattleId,
  date,
  onOpenChange,
}: {
  entry: FeedCattleHistoryEntry | null;
  cattleId: string | null;
  date: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("feeding.grid.cowHistory");
  const voidMutation = useVoidFeedCattleItem();
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    if (!entry || !cattleId) return;
    try {
      await voidMutation.mutateAsync({
        distributionId: entry.distribution_id,
        cattleItemId: entry.id,
        cattleId,
        dto: { reason: reason.trim() || undefined },
      });
      toast.success(t("voidedToast"));
      setReason("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Dialog open={entry != null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("voidDialog.title")}</DialogTitle>
          <DialogDescription>
            {entry ? t("voidDialog.description", { kg: entry.offered_kg, date }) : null}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("voidDialog.reasonPlaceholder")}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={voidMutation.isPending}>
            {t("voidDialog.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={voidMutation.isPending}>
            {voidMutation.isPending ? t("voidDialog.voiding") : t("voidDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

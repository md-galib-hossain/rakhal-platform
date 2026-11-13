"use client"; // opens the detail sheet on click + a per-card edit/delete menu

import { useTranslations } from "next-intl";
import { ArrowRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@rakhal/ui/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoneyText } from "@/components/shared/money-text";
import { balanceScoreBand } from "../lib/formula-math";
import type { FeedConcentrationSummary } from "../types";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex h-20 flex-1 flex-col items-center justify-between rounded-2xl border border-border bg-card p-2 text-center shadow-xs">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

/**
 * One "Concentrate Mixer"/"Total Mixed Ration (TMR)" card (Figma `1048:33257`/`1048:33341`). The two Figma
 * sections read the same `FeedConcentration` resource but split by the explicit `kind` field (see
 * `types.ts`'s doc comment) — this card renders the Balance Score bar only when `balance_score` is
 * present (only ever true for a `FEED_MIXTURE`). "Weight Range (kg)"/"Avg. Daily Milk Yield (L)"
 * render as single "Target Weight"/"Target Milk" values (no range exists in the schema, see
 * `types.ts`) — "Number of Cow" is 1 for an Individual target, a dash for a whole-herd one. "Finalize" (user request 2026-07-17/18) is offered on both kinds as of Phase
 * 12.2 (2026-07-18) — a `CONCENTRATE_TEMPLATE` promotes into a reusable ingredient + produces stock;
 * a `FEED_MIXTURE` produces stock only (never an ingredient — see `feed-concentration.service.ts`'s
 * `finalize()` doc comment). The multi-select checkbox (user request
 * 2026-07-18, reworked 2026-07-18 follow-up) is now always visible alongside the edit/delete/finalize
 * `⋯` menu — no separate "select mode" that hides one or the other; a card is simultaneously
 * individually-editable and bulk-selectable. "Feed Today" (Phase 12.4, 2026-07-18) — logs an actual
 * feeding + deducts stock, offered only on a `FEED_MIXTURE` card (a Concentrate Mixer has no cow
 * target to feed), gated on `feed.distribution-log` (worker-ok, matches the backend route's own
 * permission — feeding a cow is a day-to-day worker action, not a manager-only one like edit/delete).
 * **Draft/Finalized status + primary Finalize CTA** (user report 2026-07-19: Finalize was buried in
 * the "⋯" menu with no visible signal that a brand-new recipe isn't usable anywhere yet — a
 * Concentrate Mixer can't be picked in any TMR's ingredient picker, and a TMR has no inventory batch
 * to feed from, until it's been finalized at least once). `concentration.is_finalized` (added
 * 2026-07-19, backed by whether a `FeedStock` lot with this id as `sourceConcentrationId` exists —
 * see `feed-concentration.service.ts`'s `finalizedIds()`) drives a status `Badge` next to the name
 * and, while still a draft, a full-width primary "Finalize" button rendered in place of the
 * balance-score block — once finalized, that primary CTA disappears and Finalize moves back to being
 * a "produce another batch" action reachable only from the "⋯" menu, same as before.
 * **The "Best For" stat row (Number of Cow/Target Weight/Target Milk) is hidden entirely
 * for a `CONCENTRATE_TEMPLATE`** (user report 2026-07-19) — none of those fields ever apply to a
 * recipe (a template has no cow target at all, see `feed-concentration.service.ts`'s `create()`,
 * which force-nulls them), so the row only ever rendered dashes; only a `FEED_MIXTURE` card
 * shows it now.
 */
export function ConcentrationCard({
  concentration,
  onSeeDetails,
  onEdit,
  onDelete,
  onFinalize,
  onFeedToday,
  onApply,
  selected = false,
  onToggleSelect,
}: {
  concentration: FeedConcentrationSummary;
  onSeeDetails: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onFinalize?: () => void;
  onFeedToday?: () => void;
  /** MILESTONE 27 (RFE-126): "Apply TMR" / "Apply Concentrate" — turns this recipe into a one-line feed plan and applies it. */
  onApply?: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const t = useTranslations("feed.card");
  const can = useCan();
  const isTemplate = concentration.kind === "CONCENTRATE_TEMPLATE";
  const cowCount = concentration.target_type === "INDIVIDUAL" ? 1 : "—";
  const band = concentration.balance_score != null ? balanceScoreBand(concentration.balance_score) : null;
  const canUpdate = can("feed.update");
  const canDelete = can("feed.delete");
  const canFinalize = canUpdate && Boolean(onFinalize);
  const canApply = canUpdate && Boolean(onApply);
  const canFeedToday = can("feed.distribution-log") && concentration.kind === "FEED_MIXTURE" && Boolean(onFeedToday);

  return (
    <div className="flex flex-1 flex-col gap-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {canDelete && onToggleSelect ? (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect()}
              aria-label={t("selectCard", { name: concentration.name })}
            />
          ) : null}
          <p className="text-xl font-bold text-foreground">{concentration.name}</p>
          <Badge variant={concentration.is_finalized ? "success" : "warning"}>
            {t(concentration.is_finalized ? "statusFinalized" : "statusDraft")}
          </Badge>
          {concentration.duration_days && concentration.duration_days > 1 ? (
            <Badge variant="outline" className="text-xs">
              {t("feedDurationDays", { days: concentration.duration_days })}
            </Badge>
          ) : null}
        </div>
        {(canUpdate && onEdit) || (canDelete && onDelete) || canFinalize || canFeedToday || canApply ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("moreActions")} className="size-8 shrink-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canApply ? (
                <DropdownMenuItem onSelect={onApply}>
                  {t(concentration.kind === "FEED_MIXTURE" ? "applyProgramMixture" : "applyProgramTemplate")}
                </DropdownMenuItem>
              ) : null}
              {canFeedToday ? <DropdownMenuItem onSelect={onFeedToday}>{t("feedToday")}</DropdownMenuItem> : null}
              {canFinalize ? <DropdownMenuItem onSelect={onFinalize}>{t("finalize")}</DropdownMenuItem> : null}
              {canUpdate && onEdit ? <DropdownMenuItem onSelect={onEdit}>{t("edit")}</DropdownMenuItem> : null}
              {canDelete && onDelete ? (
                <DropdownMenuItem onSelect={onDelete} className="text-destructive">
                  {t("delete")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {!isTemplate ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-sm text-muted-foreground">{t("bestFor")}</p>
            <div className="flex gap-2 text-center">
              <StatBox label={t("numberOfCow")} value={cowCount} />
              <StatBox label={t("targetWeight")} value={concentration.target_weight_kg ?? "—"} />
              <StatBox label={t("targetMilk")} value={concentration.target_milk_l ?? "—"} />
            </div>
          </div>
        ) : null}

        {concentration.balance_score != null && band ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">{t("balanceScore")}</p>
              <p
                className={cn(
                  "font-bold",
                  band === "success" ? "text-success" : band === "warning" ? "text-warning" : "text-destructive",
                )}
              >
                {concentration.balance_score}%
              </p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded bg-muted">
              <div
                className={cn(
                  "h-full rounded",
                  band === "success" ? "bg-success" : band === "warning" ? "bg-warning" : "bg-destructive",
                )}
                style={{ width: `${Math.min(concentration.balance_score, 100)}%` }}
              />
            </div>
          </div>
        ) : null}

        {!concentration.is_finalized && canFinalize ? (
          <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={onFinalize}>
            {t(concentration.kind === "FEED_MIXTURE" ? "finalizeCtaMixture" : "finalizeCtaTemplate")}
          </Button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl bg-card px-3 py-2 shadow-card">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{t("totalCost")}</p>
          <p className="text-base font-bold text-foreground">
            <MoneyText amount={concentration.totals.total_cost_tk} />
          </p>
        </div>
        <button
          type="button"
          onClick={onSeeDetails}
          className="flex items-center gap-2 rounded-lg border-[1.5px] border-input px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted"
        >
          {t("seeDetails")}
          <ArrowRight className="size-[18px]" aria-hidden />
        </button>
      </div>
    </div>
  );
}

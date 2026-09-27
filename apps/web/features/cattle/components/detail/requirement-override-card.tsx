"use client"; // mode switch, form state, confirm dialog and a lazily-mounted history list

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Edit3,
  History,
  Info,
  PencilLine,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { Can } from "@/lib/auth/permissions";
import { useRequirementOverride, useTurnOffRequirementOverride } from "@/features/feed/hooks/use-requirement-override";
import type { FeedRequirementBreakdown, FeedRequirements, RequirementOverrideWarning } from "@/features/feed/types";
import { formDefaults, fmt } from "./requirement/profile";
import { RequirementHistory } from "./requirement/requirement-history";
import { RequirementProfileForm } from "./requirement/requirement-profile-form";
import { RequirementProfileTable } from "./requirement/requirement-profile-table";

/**
 * "Nutrition requirement" on the cattle Feeding tab (MILESTONE 28 RFE-129, MILESTONE 28b RFE-131/132).
 * A cow's requirement is either fully calculated from her records (Manual OFF) or hand-set (Manual ON).
 * When Manual is OFF, automatic calculations apply everywhere and requirements are displayed in a clean read-only table.
 * When Manual is turned ON, a form allows entering custom requirements by hand with calculated baselines and live derived values.
 */
export function RequirementOverrideCard({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.feeding.requirement");
  const locale = useLocale() as Locale;
  const q = useRequirementOverride(cattleId);
  const turnOff = useTurnOffRequirementOverride(cattleId);
  const [editing, setEditing] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [warnings, setWarnings] = useState<RequirementOverrideWarning[]>([]);

  if (q.isLoading) return <CardSkeleton lines={4} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  const { active, resolved, last } = q.data;
  const manual = resolved.source === "MANUAL";
  // What the calculated model says today, in both modes
  const calculated: FeedRequirements =
    q.data.calculated ?? (manual ? resolved.dynamic_requirements : resolved.requirements) ?? resolved.requirements;
  const info = resolved.manual;

  async function confirmTurnOff() {
    try {
      await turnOff.mutateAsync();
      setWarnings([]);
      setEditing(false);
      toast.success(t("turnedOffToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const defaults = {
    ...formDefaults(calculated, { row: active ?? last, resolved: manual ? resolved.requirements : null }),
    note: active?.note ?? "",
  };

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      {/* Header: Title, Active Mode Badge, and Manual Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground tracking-tight">{t("title")}</h3>
              <Badge
                variant={manual || editing ? "warning" : "outline"}
                className="h-5 px-2 text-[11px] font-medium"
              >
                {manual || editing ? t("mode.manual") : t("mode.calculated")}
              </Badge>
            </div>
          </div>
        </div>

        <Can
          I="feed.update"
          fallback={
            <Badge variant={manual ? "warning" : "secondary"} className="h-6 px-2.5 text-xs font-medium">
              {t(manual ? "mode.manual" : "mode.calculated")}
            </Badge>
          }
        >
          <div
            role="group"
            aria-label={t("modeLabel")}
            className="flex items-center gap-2.5 rounded-full border border-border/80 bg-muted/40 px-3 py-1.5 transition-colors"
          >
            <label
              htmlFor="manual-override-toggle"
              className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-medium text-foreground"
            >
              <span>{t("mode.manual")}</span>
              <Badge
                variant={manual || editing ? "warning" : "outline"}
                className="h-4 px-1.5 py-0 text-[10px] font-semibold"
              >
                {manual || editing ? "ON" : "OFF"}
              </Badge>
            </label>
            <Switch
              id="manual-override-toggle"
              checked={manual || editing}
              onCheckedChange={(checked) => {
                if (checked) {
                  setEditing(true);
                } else if (manual) {
                  setConfirmOff(true);
                } else {
                  setEditing(false);
                }
              }}
              aria-label={t("mode.manual")}
            />
          </div>
        </Can>
      </div>

      {/* Contextual Status Banners */}
      {editing ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs">
          <PencilLine className="size-4 shrink-0 text-primary mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-foreground">
              {manual ? t("form.replaceHint") : t("form.newHint")}
            </p>
            <p className="text-muted-foreground">{t("form.frozenHint")}</p>
            {!manual && (
              <p className="font-medium text-warning mt-0.5">{t("pending")}</p>
            )}
          </div>
        </div>
      ) : manual && info ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <SlidersHorizontal className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">
                  {active
                    ? active.set_by_name
                      ? t("status.manualBy", { date: formatDate(active.effective_from, locale), name: active.set_by_name })
                      : t("status.manual", { date: formatDate(active.effective_from, locale) })
                    : null}
                </span>
                {info.note ? <span className="text-foreground">{t("note", { note: info.note })}</span> : null}
                <span className="text-muted-foreground">
                  {resolved.requirements.calcium_kg === null ? t("manualHintLegacy") : t("manualHint")}
                </span>
              </div>
            </div>

            <Can I="feed.update">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 bg-background shadow-2xs shrink-0"
                onClick={() => setEditing(true)}
              >
                <Edit3 className="size-3.5" />
                {t("edit")}
              </Button>
            </Can>
          </div>

          {info.stale ? (
            <div className="flex items-center gap-2 rounded-lg bg-warning-tint p-2 text-xs font-medium text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                {info.animal_type_changed
                  ? t("stale.type")
                  : t("stale.drift", {
                      pct: Math.round(Math.max(info.drift.dm_pct, info.drift.cp_pct, info.drift.me_pct)),
                    })}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs">
          <Calculator className="size-4 shrink-0 text-primary mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold text-foreground">
              {t("status.calculated")}
            </p>
            <p className="text-muted-foreground">
              {t("calculatedSummary", { dm: fmt(calculated.dm_kg), cp: fmt(calculated.cp_kg), me: fmt(calculated.me_mj) })}
            </p>
            <p className="text-muted-foreground/80 mt-0.5">{t("appliesEverywhere")}</p>
          </div>
        </div>
      )}

      {/* Main Content: Form (when editing) or Table View */}
      {editing ? (
        <RequirementProfileForm
          cattleId={cattleId}
          calculated={calculated}
          defaults={defaults}
          weightKg={resolved.inputs.weight_kg}
          replacing={manual}
          onCancel={() => setEditing(false)}
          onSaved={(w) => {
            setWarnings(w);
            setEditing(false);
          }}
        />
      ) : manual && info ? (
        <RequirementProfileTable calculated={calculated} manual={resolved.requirements} />
      ) : (
        <>
          <RequirementProfileTable calculated={calculated} />
          {calculated.breakdown ? <HowCalculated breakdown={calculated.breakdown} /> : null}
        </>
      )}

      {/* Warnings Banner */}
      {warnings.length > 0 ? (
        <ul role="status" className="flex flex-col gap-1 rounded-xl bg-warning-tint p-3 text-xs text-warning">
          {warnings.map((w) => (
            <li key={`${w.code}-${w.field ?? ""}`} className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>{t.has(`warning.${w.code}`) ? t(`warning.${w.code}`) : w.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* History Drawer Trigger */}
      <div className="border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          aria-expanded={historyOpen}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <History className="size-3.5 text-primary" />
          <span>{t("history.toggle")}</span>
          {historyOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        {historyOpen ? (
          <div className="pt-3">
            <RequirementHistory cattleId={cattleId} />
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title={t("turnOffTitle")}
        description={t("turnOffDescription")}
        confirmLabel={t("turnOff")}
        cancelLabel={t("form.cancel")}
        variant="primary"
        onConfirm={confirmTurnOff}
      />
    </Card>
  );
}

/** "How this is calculated": what makes up her dry matter, energy and protein figures (calculated mode only). */
function HowCalculated({ breakdown }: { breakdown: FeedRequirementBreakdown }) {
  const t = useTranslations("cattle.feeding.requirement.breakdown");
  const [open, setOpen] = useState(false);
  const groups = [
    ["dm", breakdown.dm, "kg"],
    ["me", breakdown.me, "MJ"],
    ["cp", breakdown.cp, "kg"],
  ] as const;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between text-xs font-medium text-foreground transition-colors hover:text-primary"
      >
        <span className="flex items-center gap-1.5">
          <Info className="size-3.5 text-primary" />
          {t("toggle")}
        </span>
        {open ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
      </button>

      {open ? (
        <div className="grid gap-2.5 pt-1 sm:grid-cols-3">
          {groups.map(([key, parts, unit]) => (
            <dl key={key} className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs">
              <dt className="border-b border-border/50 pb-1 font-semibold text-foreground">
                {t(`group.${key}`)}
              </dt>
              {Object.entries(parts).map(([part, value]) => (
                <dd key={part} className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>{t.has(`part.${part}`) ? t(`part.${part}`) : part}</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {fmt(value as number)} <span className="text-[10px] font-normal text-muted-foreground">{unit}</span>
                  </span>
                </dd>
              ))}
            </dl>
          ))}
        </div>
      ) : null}
    </div>
  );
}

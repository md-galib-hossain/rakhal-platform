"use client"; // live query + local edits

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import { Switch } from "@rakhal/ui/ui/switch";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { useFollowUpRules, useUpdateFollowUpRules, type FollowUpRule, type FollowUpRuleUpdate } from "../hooks/use-follow-up-rules";

const KNOWN_RULES = new Set(["BREEDING_TO_PREG_CHECK", "PREG_POSITIVE_TO_DRY_OFF", "PREG_POSITIVE_TO_CALVING_WATCH"]);

interface Edit {
  enabled?: boolean;
  /** `null` = back to the rule's default offset. */
  offsetDays?: number | null;
}

/** Effective values of a rule once the unsaved edits are applied. */
export function effective(rule: FollowUpRule, edit: Edit | undefined) {
  const enabled = edit?.enabled ?? rule.enabled;
  const offset = edit && edit.offsetDays !== undefined ? (edit.offsetDays ?? rule.defaultOffsetDays) : rule.offsetDays;
  return { enabled, offset };
}

/** What to send for the rules that actually changed; an offset equal to the default is sent as `null` (back to default). */
export function changedRules(rules: FollowUpRule[], edits: Record<string, Edit>): FollowUpRuleUpdate[] {
  const updates: FollowUpRuleUpdate[] = [];
  for (const rule of rules) {
    const now = effective(rule, edits[rule.ruleKey]);
    if (now.enabled === rule.enabled && now.offset === rule.offsetDays) continue;
    updates.push({
      ruleKey: rule.ruleKey,
      enabled: now.enabled,
      offsetDays: now.offset === null || now.offset === rule.defaultOffsetDays ? null : now.offset,
    });
  }
  return updates;
}

/**
 * Settings → Follow-up reminders (RFE-168, RAKHAL-484): each code-defined rule with an on/off switch and its day
 * offset, saved with one PUT, and a per-rule reset to the default. Everyone with `settings.read` sees it; only
 * `settings.update` (manager and above) can change it, others get a read-only list.
 */
export function FollowUpRulesView() {
  const t = useTranslations("settings.followUps");
  const can = useCan();
  const canEdit = can("settings.update");
  const query = useFollowUpRules();
  const update = useUpdateFollowUpRules();
  const [edits, setEdits] = useState<Record<string, Edit>>({});

  if (query.isLoading) return <CardSkeleton lines={4} />;
  if (query.isError) {
    const forbidden = query.error instanceof ApiError && query.error.isForbidden;
    return <ErrorState description={forbidden ? t("forbidden") : t("error")} onRetry={forbidden ? undefined : () => void query.refetch()} />;
  }
  const rules = query.data ?? [];
  if (rules.length === 0) return <EmptyState title={t("empty")} className="py-8" />;
  const updates = changedRules(rules, edits);

  function patch(ruleKey: string, next: Edit) {
    setEdits((previous) => ({ ...previous, [ruleKey]: { ...previous[ruleKey], ...next } }));
  }

  async function save() {
    try {
      await update.mutateAsync(updates);
      setEdits({});
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("error"));
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="follow-up-rules-title">
      <div className="flex flex-col gap-1">
        <h2 id="follow-up-rules-title" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        {!canEdit ? <p className="text-sm font-medium text-muted-foreground">{t("readOnly")}</p> : null}
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {rules.map((rule) => {
          const now = effective(rule, edits[rule.ruleKey]);
          const changedFromDefault = now.enabled !== rule.defaultOn || (rule.defaultOffsetDays !== null && now.offset !== rule.defaultOffsetDays);
          const title = KNOWN_RULES.has(rule.ruleKey) ? t(`rules.${rule.ruleKey}`) : rule.title;
          return (
            <li key={rule.ruleKey} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Switch
                  checked={now.enabled}
                  disabled={!canEdit}
                  aria-label={title}
                  onCheckedChange={(checked) => patch(rule.ruleKey, { enabled: checked })}
                />
                <span className="text-sm font-medium text-foreground">{title}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {rule.defaultOffsetDays !== null ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="sr-only">{t("offsetLabel", { rule: title })}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={400}
                      disabled={!canEdit || !now.enabled}
                      value={now.offset ?? ""}
                      onChange={(event) => patch(rule.ruleKey, { offsetDays: event.target.value === "" ? null : Math.min(400, Math.max(0, Math.round(Number(event.target.value)))) })}
                      className="h-11 w-24 rounded-lg border border-input bg-background px-3 text-base text-foreground disabled:opacity-50 sm:h-10 sm:text-sm"
                    />
                    {t("days")}
                  </label>
                ) : null}
                {rule.defaultOffsetDays !== null ? <span className="text-xs text-muted-foreground">{t("defaultHint", { days: rule.defaultOffsetDays })}</span> : null}
                {canEdit && changedFromDefault ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-11 sm:h-9"
                    onClick={() => patch(rule.ruleKey, { enabled: rule.defaultOn, offsetDays: null })}
                  >
                    {t("reset")}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {canEdit ? (
        <div className="flex gap-3">
          <Button type="button" className="h-12 w-full sm:w-auto" disabled={updates.length === 0 || update.isPending} onClick={() => void save()}>
            {update.isPending ? t("saving") : t("save")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

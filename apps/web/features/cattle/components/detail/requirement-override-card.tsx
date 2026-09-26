"use client"; // mode switch, form state, confirm dialog and a lazily-mounted history list

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LabeledInput } from "@/components/ui/labeled-field";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { Can } from "@/lib/auth/permissions";
import {
  useRequirementOverride,
  useRequirementOverrideHistory,
  useSetRequirementOverride,
  useTurnOffRequirementOverride,
} from "@/features/feed/hooks/use-requirement-override";
import { requirementOverrideFormSchema, type RequirementOverrideFormValues } from "@/features/feed/schemas";
import type { FeedRequirements, RequirementOverrideWarning } from "@/features/feed/types";

const r2 = (n: number) => String(Math.round(n * 100) / 100);
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

/**
 * "Nutrition requirement" on the cattle Feeding tab (MILESTONE 28, RFE-129). A cow's requirement is either fully
 * calculated from her records or fully hand-set (DM, CP, ME) — never a mix. Managers switch between the two; a
 * worker sees the same card read-only. Turning manual on pre-fills the form with today's calculated figures (or the
 * last manual ones); turning it off asks first. Every change is kept in the history below.
 */
export function RequirementOverrideCard({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.feeding.requirement");
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
  const calculated: FeedRequirements =
    (manual ? resolved.dynamic_requirements : resolved.requirements) ?? resolved.requirements;
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

  const prefill = active ?? last;
  const defaults: RequirementOverrideFormValues = {
    dmKg: r2(prefill ? prefill.dm_kg : calculated.dm_kg),
    cpKg: r2(prefill ? prefill.cp_kg : calculated.cp_kg),
    meMj: r2(prefill ? prefill.me_mj : calculated.me_mj),
    note: active?.note ?? "",
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
        <Can
          I="feed.update"
          fallback={<Badge variant={manual ? "warning" : "secondary"}>{t(manual ? "mode.manual" : "mode.calculated")}</Badge>}
        >
          <div role="group" aria-label={t("modeLabel")} className="flex gap-1 rounded-lg border border-border p-0.5">
            <Button
              size="sm"
              variant={manual || editing ? "ghost" : "secondary"}
              aria-pressed={!manual && !editing}
              onClick={() => (manual ? setConfirmOff(true) : setEditing(false))}
            >
              {t("mode.calculated")}
            </Button>
            <Button
              size="sm"
              variant={manual || editing ? "secondary" : "ghost"}
              aria-pressed={manual || editing}
              onClick={() => setEditing(true)}
            >
              {t("mode.manual")}
            </Button>
          </div>
        </Can>
      </div>

      {editing ? (
        <RequirementForm
          cattleId={cattleId}
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
        <>
          {info.stale ? (
            <p role="status" className="rounded-lg bg-warning-tint p-2 text-xs text-warning">
              {info.animal_type_changed
                ? t("stale.type")
                : t("stale.drift", {
                    pct: Math.round(Math.max(info.drift.dm_pct, info.drift.cp_pct, info.drift.me_pct)),
                  })}
            </p>
          ) : null}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-normal">{t("nutrient")}</th>
                <th className="py-1 font-normal">{t("mode.manual")}</th>
                <th className="py-1 font-normal">{t("mode.calculated")}</th>
                <th className="py-1 text-right font-normal">{t("drift")}</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  { key: "dm", unit: "kg", m: resolved.requirements.dm_kg, c: calculated.dm_kg, d: info.drift.dm_pct },
                  { key: "cp", unit: "kg", m: resolved.requirements.cp_kg, c: calculated.cp_kg, d: info.drift.cp_pct },
                  { key: "me", unit: "MJ", m: resolved.requirements.me_mj, c: calculated.me_mj, d: info.drift.me_pct },
                ] as const
              ).map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="py-1.5 text-foreground">
                    {t(`nutrients.${r.key}`)} <span className="text-muted-foreground">({r.unit})</span>
                  </td>
                  <td className="py-1.5 font-medium tabular-nums">{f1(r.m)}</td>
                  <td className="py-1.5 tabular-nums text-muted-foreground">{f1(r.c)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{f1(r.d)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {info.note ? <p className="text-xs text-muted-foreground">{t("note", { note: info.note })}</p> : null}
          <p className="text-xs text-muted-foreground">{t("manualHint")}</p>
          <Can I="feed.update">
            <div>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                {t("edit")}
              </Button>
            </div>
          </Can>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("calculatedSummary", { dm: f1(calculated.dm_kg), cp: r2(calculated.cp_kg), me: f1(calculated.me_mj) })}
        </p>
      )}

      {warnings.length > 0 ? (
        <ul role="status" className="flex flex-col gap-1 rounded-lg bg-warning-tint p-2 text-xs text-warning">
          {warnings.map((w) => (
            <li key={w.code}>{t(`warning.${w.code}`)}</li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => setHistoryOpen((o) => !o)}
        aria-expanded={historyOpen}
        className="flex items-center gap-1 self-start text-xs font-medium text-primary"
      >
        {historyOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {t("history.toggle")}
      </button>
      {historyOpen ? <RequirementHistory cattleId={cattleId} /> : null}

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

function RequirementForm({
  cattleId,
  defaults,
  weightKg,
  replacing,
  onCancel,
  onSaved,
}: {
  cattleId: string;
  defaults: RequirementOverrideFormValues;
  weightKg: number;
  replacing: boolean;
  onCancel: () => void;
  onSaved: (warnings: RequirementOverrideWarning[]) => void;
}) {
  const t = useTranslations("cattle.feeding.requirement");
  const save = useSetRequirementOverride(cattleId);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RequirementOverrideFormValues>({
    resolver: zodResolver(requirementOverrideFormSchema),
    defaultValues: defaults,
  });
  const [dmText, cpText, meText] = useWatch({ control, name: ["dmKg", "cpKg", "meMj"] });
  const [dm, cp, me] = [Number(dmText), Number(cpText), Number(meText)];
  const ok = (n: number) => Number.isFinite(n) && n > 0;
  const err = (m?: string) => (m ? t(`form.error.${m}`) : undefined);

  async function onSubmit(v: RequirementOverrideFormValues) {
    try {
      const res = await save.mutateAsync({
        dmKg: Number(v.dmKg),
        cpKg: Number(v.cpKg),
        meMj: Number(v.meMj),
        ...(v.note ? { note: v.note } : {}),
      });
      toast.success(t("savedToast"));
      onSaved(res.warnings);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("genericError"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <p className="text-xs text-muted-foreground">{replacing ? t("form.replaceHint") : t("form.newHint")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <LabeledInput label={t("form.dm")} inputMode="decimal" error={err(errors.dmKg?.message)} {...register("dmKg")} />
          {ok(dm) && ok(weightKg) ? (
            <p className="text-xs text-muted-foreground">{t("form.hintDm", { pct: f1((dm / weightKg) * 100) })}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <LabeledInput label={t("form.cp")} inputMode="decimal" error={err(errors.cpKg?.message)} {...register("cpKg")} />
          {ok(cp) && ok(dm) ? (
            <p className="text-xs text-muted-foreground">{t("form.hintCp", { pct: f1((cp / dm) * 100) })}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <LabeledInput label={t("form.me")} inputMode="decimal" error={err(errors.meMj?.message)} {...register("meMj")} />
          {ok(me) && ok(dm) ? (
            <p className="text-xs text-muted-foreground">{t("form.hintMe", { value: f1(me / dm) })}</p>
          ) : null}
        </div>
      </div>
      <LabeledInput label={t("form.note")} maxLength={300} error={err(errors.note?.message)} {...register("note")} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? t("form.saving") : t("form.save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={save.isPending}>
          {t("form.cancel")}
        </Button>
      </div>
    </form>
  );
}

function RequirementHistory({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.feeding.requirement.history");
  const locale = useLocale() as Locale;
  const pager = useRequirementOverrideHistory(cattleId);

  if (pager.isLoading) return <CardSkeleton lines={3} />;
  if (pager.isError) return <ErrorState onRetry={() => pager.refetch()} />;
  if (pager.items.length === 0) return <p className="text-xs text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {pager.items.map((r) => (
          <li key={r.id} className="rounded-lg border border-border p-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-medium text-foreground">
                {formatDate(r.effective_from, locale)} – {r.effective_to ? formatDate(r.effective_to, locale) : t("now")}
              </span>
              <Badge variant={r.effective_to ? "secondary" : "warning"}>
                {r.end_reason ? t(`end.${r.end_reason}`) : t("current")}
              </Badge>
            </div>
            <p className="mt-1 tabular-nums text-foreground">
              {t("values", { dm: f1(r.dm_kg), cp: r2(r.cp_kg), me: f1(r.me_mj) })}
            </p>
            <p className="tabular-nums text-muted-foreground">
              {t("calculatedThen", {
                dm: f1(r.dynamic_snapshot.dm_kg),
                cp: r2(r.dynamic_snapshot.cp_kg),
                me: f1(r.dynamic_snapshot.me_mj),
              })}
            </p>
            {r.note ? <p className="text-muted-foreground">{r.note}</p> : null}
          </li>
        ))}
      </ul>
      {pager.totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={pager.page <= 1} onClick={() => pager.goToPage(pager.page - 1)}>
            {t("newer")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pager.page >= pager.totalPages}
            onClick={() => pager.goToPage(pager.page + 1)}
          >
            {t("older")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

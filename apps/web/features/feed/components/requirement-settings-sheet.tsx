"use client"; // form state over the tuning numbers

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rakhal/ui/ui/dialog";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";
import {
  useRequirementSettings,
  useResetRequirementSettings,
  useUpdateRequirementSettings,
} from "../hooks/use-requirement-settings";
import type { RequirementSettingSource, RequirementSettingsResult } from "../types";

/**
 * Farm-level tuning of the requirement model (RFE-104, backend RAKHAL-409).
 *
 * The 32 numbers behind every requirement calculation, editable per farm. Values resolve
 * **farm changes -> Rakhal's active preset -> the built-in defaults**, and each field shows
 * which of those three it currently comes from, so a farmer can tell what they have actually
 * overridden from what they are merely inheriting.
 *
 * Labels, units, bounds and grouping all come from the backend's own `fields` block rather
 * than being restated here — there is one definition of "protein per litre of milk is measured
 * in g/L and must sit between 20 and 200", and it lives in the domain.
 *
 * Only changed fields are sent, so a farm that adjusts one number keeps inheriting a later
 * Rakhal retune for the other 31.
 */
export function RequirementSettingsSheet() {
  const t = useTranslations("feed.requirementSettings");
  const [open, setOpen] = useState(false);

  return (
    <Can I="feed.update">
      <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" aria-hidden />
        {t("open")}
      </Button>
      {open ? <SettingsDialog onClose={() => setOpen(false)} /> : null}
    </Can>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("feed.requirementSettings");
  const settings = useRequirementSettings();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {settings.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : settings.isError || !settings.data ? (
          <ErrorState onRetry={() => void settings.refetch()} />
        ) : (
          <SettingsForm data={settings.data} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ data, onClose }: { data: RequirementSettingsResult; onClose: () => void }) {
  const t = useTranslations("feed.requirementSettings");
  const update = useUpdateRequirementSettings();
  const reset = useResetRequirementSettings();

  /** Every field as a string, seeded from the effective value so the form shows what is in force. */
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.keys(data.fields).map((key) => [key, String(data.effective[key] ?? "")]),
    ),
  );

  const groups = useMemo(() => {
    const byGroup = new Map<string, string[]>();
    for (const [key, field] of Object.entries(data.fields)) {
      const list = byGroup.get(field.group) ?? [];
      list.push(key);
      byGroup.set(field.group, list);
    }
    return [...byGroup.entries()];
  }, [data.fields]);

  /** Only what actually moved, and only if it parses — the backend treats this as the whole set. */
  const changed = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [key, raw] of Object.entries(draft)) {
      const value = Number(raw);
      if (raw.trim() === "" || Number.isNaN(value)) continue;
      if (value !== Number(data.effective[key])) out[key] = value;
    }
    return out;
  }, [draft, data.effective]);

  const invalid = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, raw] of Object.entries(draft)) {
      const spec = data.fields[key];
      const value = Number(raw);
      if (raw.trim() === "" || Number.isNaN(value)) out[key] = t("mustBeNumber");
      else if (value < spec.min || value > spec.max) {
        out[key] = t("outOfRange", { min: spec.min, max: spec.max });
      }
    }
    return out;
  }, [draft, data.fields, t]);

  const changedCount = Object.keys(changed).length;
  const hasInvalid = Object.keys(invalid).length > 0;
  const overriddenCount = Object.keys(data.farm_changes).length;

  async function handleSave() {
    try {
      await update.mutateAsync({ changes: changed });
      toast.success(t("saved", { count: changedCount }));
      onClose();
    } catch (error) {
      // The backend names every bad field in one message, so show it verbatim.
      toast.error(error instanceof ApiError ? error.message : t("saveFailed"));
    }
  }

  async function handleResetAll() {
    try {
      await reset.mutateAsync(undefined);
      toast.success(t("resetDone"));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("resetFailed"));
    }
  }

  /** Put one field back to what it would be without this farm's own change. */
  function resetField(key: string) {
    const inherited =
      data.farm_changes[key] !== undefined ? data.defaults[key] : data.effective[key];
    setDraft((d) => ({ ...d, [key]: String(inherited ?? "") }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
        <Badge variant="secondary">
          {t("basedOn")}: {data.preset?.name ?? t("builtIn")}
        </Badge>
        <Badge variant="outline">{t("overridden", { count: overriddenCount })}</Badge>
        <p className="w-full text-xs text-muted-foreground">{t("notRetroactive")}</p>
      </div>

      {groups.map(([group, keys]) => (
        <section key={group} className="flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t(`group.${group}`)}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {keys.map((key) => (
              <SettingRow
                key={key}
                label={data.fields[key].label}
                unit={data.fields[key].unit}
                source={data.sources[key]}
                value={draft[key]}
                error={invalid[key]}
                dirty={changed[key] !== undefined}
                onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                onReset={() => resetField(key)}
              />
            ))}
          </div>
        </section>
      ))}

      <DialogFooter className="flex-wrap gap-2">
        <Button
          variant="ghost"
          className="gap-1.5"
          disabled={reset.isPending || overriddenCount === 0}
          onClick={() => void handleResetAll()}
        >
          <RotateCcw className="size-4" aria-hidden />
          {t("resetAll")}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          disabled={update.isPending || hasInvalid || changedCount === 0}
          onClick={() => void handleSave()}
        >
          {update.isPending ? t("saving") : t("save", { count: changedCount })}
        </Button>
      </DialogFooter>
    </div>
  );
}

const SOURCE_CLASS: Record<RequirementSettingSource, string> = {
  farm: "text-success",
  preset: "text-info",
  default: "text-muted-foreground",
};

function SettingRow({
  label,
  unit,
  source,
  value,
  error,
  dirty,
  onChange,
  onReset,
}: {
  label: string;
  unit: string;
  source: RequirementSettingSource;
  value: string;
  error?: string;
  dirty: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const t = useTranslations("feed.requirementSettings");

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className={cn("shrink-0 text-xs font-bold uppercase", SOURCE_CLASS[source])}>
          {t(`source.${source}`)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className={cn(
            "h-9 w-full rounded-lg border bg-background px-2 text-sm text-foreground",
            error ? "border-destructive" : "border-border",
          )}
        />
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={onReset} aria-label={t("resetField")}>
            <RotateCcw className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>

      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : unit ? (
        <span className="text-xs text-muted-foreground">{unit}</span>
      ) : null}
    </div>
  );
}
